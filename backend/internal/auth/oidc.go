package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// OIDCConfig holds OpenID Connect configuration
type OIDCConfig struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

// OIDCProvider handles OIDC authentication
type OIDCProvider struct {
	config     OIDCConfig
	httpClient *http.Client
}

func NewOIDCProvider(config OIDCConfig) *OIDCProvider {
	return &OIDCProvider{
		config: config,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// DiscoveryDocument represents OIDC discovery document
type DiscoveryDocument struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
}

// GetDiscoveryDocument fetches the OIDC discovery document
func (o *OIDCProvider) GetDiscoveryDocument(ctx context.Context) (*DiscoveryDocument, error) {
	url := fmt.Sprintf("%s/.well-known/openid-configuration", strings.TrimSuffix(o.config.Issuer, "/"))
	
	resp, err := o.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch discovery document: %w", err)
	}
	defer resp.Body.Close()

	var doc DiscoveryDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("failed to decode discovery document: %w", err)
	}

	return &doc, nil
}

// GetAuthorizationURL returns the URL to redirect users for authentication
func (o *OIDCProvider) GetAuthorizationURL(state string) (string, error) {
	doc, err := o.GetDiscoveryDocument(context.Background())
	if err != nil {
		return "", err
	}

	scopes := strings.Join(o.config.Scopes, " ")
	if scopes == "" {
		scopes = "openid profile email"
	}

	return fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
		doc.AuthorizationEndpoint,
		o.config.ClientID,
		o.config.RedirectURL,
		scopes,
		state,
	), nil
}

// ExchangeCode exchanges an authorization code for tokens
func (o *OIDCProvider) ExchangeCode(ctx context.Context, code string) (*TokenSet, error) {
	doc, err := o.GetDiscoveryDocument(ctx)
	if err != nil {
		return nil, err
	}

	data := fmt.Sprintf("grant_type=authorization_code&code=%s&redirect_uri=%s&client_id=%s&client_secret=%s",
		code,
		o.config.RedirectURL,
		o.config.ClientID,
		o.config.ClientSecret,
	)

	req, err := http.NewRequestWithContext(ctx, "POST", doc.TokenEndpoint, strings.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var tokenSet TokenSet
	if err := json.Unmarshal(body, &tokenSet); err != nil {
		return nil, err
	}

	return &tokenSet, nil
}

// ValidateToken validates an ID token
func (o *OIDCProvider) ValidateToken(ctx context.Context, idToken string) (*jwt.Token, error) {
	token, err := jwt.Parse(idToken, func(token *jwt.Token) (interface{}, error) {
		// In production, fetch the signing key from JWKS endpoint
		return []byte(o.config.ClientSecret), nil
	})
	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return token, nil
}

// TokenSet contains OIDC tokens
type TokenSet struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	IDToken      string `json:"id_token"`
}

// UserInfo represents the user information from OIDC
type UserInfo struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}
