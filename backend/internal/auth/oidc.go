package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// OIDCConfig holds OpenID Connect configuration (env-driven).
type OIDCConfig struct {
	Enabled      bool
	Issuer       string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
	// When true, skip remote discovery and use demo mode endpoints.
	DemoMode bool
}

// OIDCProvider handles OIDC authentication (authorization code flow).
type OIDCProvider struct {
	config     OIDCConfig
	httpClient *http.Client
	states     *stateStore
	docCache   *DiscoveryDocument
	docAt      time.Time
}

type stateStore struct {
	mu   sync.Mutex
	data map[string]time.Time
}

func newStateStore() *stateStore {
	return &stateStore{data: make(map[string]time.Time)}
}

func (s *stateStore) Put(state string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[state] = time.Now().Add(10 * time.Minute)
	// prune
	now := time.Now()
	for k, exp := range s.data {
		if now.After(exp) {
			delete(s.data, k)
		}
	}
}

func (s *stateStore) Consume(state string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.data[state]
	if !ok || time.Now().After(exp) {
		delete(s.data, state)
		return false
	}
	delete(s.data, state)
	return true
}

func NewOIDCProvider(config OIDCConfig) *OIDCProvider {
	if len(config.Scopes) == 0 {
		config.Scopes = []string{"openid", "profile", "email"}
	}
	if config.Issuer != "" && config.ClientID != "" && config.RedirectURL != "" {
		config.Enabled = true
	}
	return &OIDCProvider{
		config: config,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		states: newStateStore(),
	}
}

func (o *OIDCProvider) Config() OIDCConfig {
	return o.config
}

func (o *OIDCProvider) Enabled() bool {
	return o.config.Enabled || o.config.DemoMode
}

// DiscoveryDocument represents OIDC discovery document.
type DiscoveryDocument struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
	EndSessionEndpoint    string `json:"end_session_endpoint,omitempty"`
}

// GetDiscoveryDocument fetches (and caches) the OIDC discovery document.
func (o *OIDCProvider) GetDiscoveryDocument(ctx context.Context) (*DiscoveryDocument, error) {
	if o.config.DemoMode || o.config.Issuer == "" {
		issuer := o.config.Issuer
		if issuer == "" {
			issuer = "https://demo.speedrunner.local"
		}
		return &DiscoveryDocument{
			Issuer:                issuer,
			AuthorizationEndpoint: issuer + "/oauth/authorize",
			TokenEndpoint:         issuer + "/oauth/token",
			UserinfoEndpoint:      issuer + "/oauth/userinfo",
			JWKSURI:               issuer + "/oauth/jwks",
		}, nil
	}
	if o.docCache != nil && time.Since(o.docAt) < 10*time.Minute {
		return o.docCache, nil
	}
	urlStr := fmt.Sprintf("%s/.well-known/openid-configuration", strings.TrimSuffix(o.config.Issuer, "/"))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}
	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch discovery document: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discovery HTTP %d: %s", resp.StatusCode, string(b))
	}
	var doc DiscoveryDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("failed to decode discovery document: %w", err)
	}
	o.docCache = &doc
	o.docAt = time.Now()
	return &doc, nil
}

// RandomState generates a CSRF state token.
func RandomState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// BeginLogin creates state and returns the authorization URL.
func (o *OIDCProvider) BeginLogin(ctx context.Context) (authURL, state string, err error) {
	if !o.Enabled() {
		return "", "", fmt.Errorf("OIDC is not configured (set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URL)")
	}
	state, err = RandomState()
	if err != nil {
		return "", "", err
	}
	o.states.Put(state)
	authURL, err = o.GetAuthorizationURL(ctx, state)
	return authURL, state, err
}

// GetAuthorizationURL returns the URL to redirect users for authentication.
func (o *OIDCProvider) GetAuthorizationURL(ctx context.Context, state string) (string, error) {
	doc, err := o.GetDiscoveryDocument(ctx)
	if err != nil {
		return "", err
	}
	scopes := strings.Join(o.config.Scopes, " ")
	q := url.Values{}
	q.Set("client_id", o.config.ClientID)
	q.Set("redirect_uri", o.config.RedirectURL)
	q.Set("response_type", "code")
	q.Set("scope", scopes)
	q.Set("state", state)
	return doc.AuthorizationEndpoint + "?" + q.Encode(), nil
}

// ExchangeCode exchanges an authorization code for tokens.
func (o *OIDCProvider) ExchangeCode(ctx context.Context, code, state string) (*TokenSet, error) {
	if state != "" && !o.states.Consume(state) {
		return nil, fmt.Errorf("invalid or expired OIDC state")
	}
	if o.config.DemoMode {
		// Demo code exchange for local UX without a real IdP.
		return &TokenSet{
			AccessToken: "demo-access-token",
			TokenType:   "Bearer",
			ExpiresIn:   3600,
			IDToken:     "demo-id-token",
		}, nil
	}
	doc, err := o.GetDiscoveryDocument(ctx)
	if err != nil {
		return nil, err
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", o.config.RedirectURL)
	form.Set("client_id", o.config.ClientID)
	form.Set("client_secret", o.config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, doc.TokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed (%d): %s", resp.StatusCode, string(body))
	}
	var tokenSet TokenSet
	if err := json.Unmarshal(body, &tokenSet); err != nil {
		return nil, err
	}
	return &tokenSet, nil
}

// FetchUserInfo retrieves user profile from the userinfo endpoint.
func (o *OIDCProvider) FetchUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	if o.config.DemoMode || strings.HasPrefix(accessToken, "demo-") {
		return &UserInfo{
			Sub:   "oidc-demo-user",
			Name:  "OIDC Demo User",
			Email: "oidc.demo@speedrunner.local",
		}, nil
	}
	doc, err := o.GetDiscoveryDocument(ctx)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, doc.UserinfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo failed (%d): %s", resp.StatusCode, string(body))
	}
	var info UserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

// ValidateToken validates an ID token (HMAC demo / simple parse for claims).
func (o *OIDCProvider) ValidateToken(ctx context.Context, idToken string) (*jwt.Token, error) {
	if idToken == "demo-id-token" {
		return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "oidc-demo-user", "email": "oidc.demo@speedrunner.local",
		}), nil
	}
	// Parse without full JWKS verification (production should validate via JWKS).
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	token, _, err := parser.ParseUnverified(idToken, jwt.MapClaims{})
	if err != nil {
		return nil, err
	}
	return token, nil
}

// Status returns a safe public status payload for the UI.
func (o *OIDCProvider) Status(ctx context.Context) map[string]interface{} {
	st := map[string]interface{}{
		"enabled":     o.Enabled(),
		"demoMode":    o.config.DemoMode,
		"issuer":      o.config.Issuer,
		"clientId":    mask(o.config.ClientID),
		"redirectUrl": o.config.RedirectURL,
		"scopes":      o.config.Scopes,
	}
	if o.Enabled() && !o.config.DemoMode && o.config.Issuer != "" {
		if doc, err := o.GetDiscoveryDocument(ctx); err == nil {
			st["discovery"] = map[string]string{
				"authorizationEndpoint": doc.AuthorizationEndpoint,
				"tokenEndpoint":         doc.TokenEndpoint,
				"userinfoEndpoint":      doc.UserinfoEndpoint,
			}
			st["discoveryOk"] = true
		} else {
			st["discoveryOk"] = false
			st["discoveryError"] = err.Error()
		}
	}
	return st
}

func mask(s string) string {
	if len(s) <= 4 {
		return "****"
	}
	return s[:2] + "****" + s[len(s)-2:]
}

// TokenSet contains OIDC tokens.
type TokenSet struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	IDToken      string `json:"id_token"`
}

// UserInfo represents the user information from OIDC.
type UserInfo struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}
