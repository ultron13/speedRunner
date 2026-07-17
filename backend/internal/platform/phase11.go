package platform

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 11 — Multi-tenant SaaS, marketplace, licensing & API productization (11.1–11.50).

// ── 11.1–11.10 Tenants & isolation ──────────────────────────────────────────

type Tenant struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Plan      string            `json:"plan"` // free|team|enterprise
	Region    string            `json:"region"`
	Status    string            `json:"status"` // active|suspended|trial
	Labels    map[string]string `json:"labels,omitempty"`
	CreatedAt time.Time         `json:"createdAt"`
}

type TenantStore struct {
	mu      sync.RWMutex
	tenants map[string]*Tenant
}

func NewTenantStore() *TenantStore {
	s := &TenantStore{tenants: make(map[string]*Tenant)}
	s.tenants["default"] = &Tenant{
		ID: "default", Name: "Default Workspace", Plan: "enterprise",
		Region: "us-east-1", Status: "active", CreatedAt: time.Now().UTC(),
	}
	return s
}

func (s *TenantStore) Upsert(t *Tenant) error {
	if t.ID == "" || t.Name == "" {
		return fmt.Errorf("id and name required")
	}
	if t.Plan == "" {
		t.Plan = "team"
	}
	if t.Status == "" {
		t.Status = "active"
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tenants[t.ID] = t
	return nil
}

func (s *TenantStore) Get(id string) (*Tenant, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tenants[id]
	return t, ok
}

func (s *TenantStore) List() []*Tenant {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Tenant, 0, len(s.tenants))
	for _, t := range s.tenants {
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func TenantIsolationOK(tenantA, tenantB string) bool {
	return tenantA != "" && tenantA == tenantB
}

// ── 11.11–11.18 Licensing & entitlements ────────────────────────────────────

type License struct {
	Key          string    `json:"key"`
	TenantID     string    `json:"tenantId"`
	MaxVUs       int       `json:"maxVUs"`
	MaxConcurrent int      `json:"maxConcurrentRuns"`
	ExpiresAt    time.Time `json:"expiresAt"`
	Features     []string  `json:"features"`
}

func ValidateLicense(l License, now time.Time, requestedVUs, concurrent int) map[string]interface{} {
	ok := true
	reasons := make([]string, 0)
	if l.Key == "" {
		ok = false
		reasons = append(reasons, "missing license key")
	}
	if !l.ExpiresAt.IsZero() && now.After(l.ExpiresAt) {
		ok = false
		reasons = append(reasons, "license expired")
	}
	if l.MaxVUs > 0 && requestedVUs > l.MaxVUs {
		ok = false
		reasons = append(reasons, fmt.Sprintf("VUs %d exceed license max %d", requestedVUs, l.MaxVUs))
	}
	if l.MaxConcurrent > 0 && concurrent > l.MaxConcurrent {
		ok = false
		reasons = append(reasons, "concurrent runs exceed license")
	}
	return map[string]interface{}{
		"valid": ok, "reasons": reasons, "features": l.Features,
		"daysRemaining": daysUntil(l.ExpiresAt, now),
	}
}

func daysUntil(exp, now time.Time) int {
	if exp.IsZero() {
		return -1
	}
	d := int(exp.Sub(now).Hours() / 24)
	if d < 0 {
		return 0
	}
	return d
}

func HasFeature(l License, feature string) bool {
	for _, f := range l.Features {
		if strings.EqualFold(f, feature) {
			return true
		}
	}
	return false
}

// ── 11.19–11.28 Marketplace (scripts, plugins, templates) ───────────────────

type MarketplaceItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Kind        string   `json:"kind"` // script|plugin|template|connector
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Tags        []string `json:"tags"`
	Downloads   int      `json:"downloads"`
	Rating      float64  `json:"rating"`
	Description string   `json:"description"`
}

type Marketplace struct {
	mu    sync.RWMutex
	items map[string]*MarketplaceItem
}

func NewMarketplace() *Marketplace {
	m := &Marketplace{items: make(map[string]*MarketplaceItem)}
	seed := []MarketplaceItem{
		{ID: "m-login", Name: "Login Flow HTTP", Kind: "script", Author: "SpeedRunner", Version: "1.2.0", Tags: []string{"http", "auth"}, Rating: 4.6, Downloads: 1200, Description: "Parameterized login scenario"},
		{ID: "m-k6-grpc", Name: "k6 gRPC Starter", Kind: "template", Author: "Community", Version: "0.9.0", Tags: []string{"k6", "grpc"}, Rating: 4.2, Downloads: 430, Description: "gRPC unary + streaming skeleton"},
		{ID: "m-splunk", Name: "Splunk APM Connector", Kind: "connector", Author: "SpeedRunner", Version: "1.0.0", Tags: []string{"splunk", "apm"}, Rating: 4.8, Downloads: 890, Description: "Ingest Splunk APM metrics"},
		{ID: "m-llm", Name: "LLM Chat Load", Kind: "script", Author: "SpeedRunner", Version: "1.0.0", Tags: []string{"llm", "ai"}, Rating: 4.5, Downloads: 310, Description: "OpenAI-compatible chat load profile"},
	}
	for i := range seed {
		it := seed[i]
		m.items[it.ID] = &it
	}
	return m
}

func (m *Marketplace) List(kind, tag string) []*MarketplaceItem {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*MarketplaceItem, 0)
	for _, it := range m.items {
		if kind != "" && !strings.EqualFold(it.Kind, kind) {
			continue
		}
		if tag != "" {
			found := false
			for _, t := range it.Tags {
				if strings.EqualFold(t, tag) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		out = append(out, it)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Downloads > out[j].Downloads })
	return out
}

func (m *Marketplace) Install(id string) (*MarketplaceItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	it, ok := m.items[id]
	if !ok {
		return nil, fmt.Errorf("item not found")
	}
	it.Downloads++
	return it, nil
}

func (m *Marketplace) Publish(it *MarketplaceItem) error {
	if it.ID == "" || it.Name == "" {
		return fmt.Errorf("id and name required")
	}
	if it.Version == "" {
		it.Version = "0.1.0"
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.items[it.ID] = it
	return nil
}

// ── 11.29–11.38 API productization (keys scopes, rate tiers, webhooks delivery) ─

type APIProductTier struct {
	Name        string `json:"name"`
	RPM         int    `json:"requestsPerMinute"`
	DailyQuota  int    `json:"dailyQuota"`
	Burst       int    `json:"burst"`
}

func DefaultAPITiers() []APIProductTier {
	return []APIProductTier{
		{Name: "free", RPM: 60, DailyQuota: 5000, Burst: 20},
		{Name: "team", RPM: 600, DailyQuota: 100000, Burst: 100},
		{Name: "enterprise", RPM: 6000, DailyQuota: 0, Burst: 1000},
	}
}

func APITierForPlan(plan string) APIProductTier {
	for _, t := range DefaultAPITiers() {
		if strings.EqualFold(t.Name, plan) {
			return t
		}
	}
	return DefaultAPITiers()[0]
}

func ScopeAllows(granted []string, required string) bool {
	for _, g := range granted {
		if g == "*" || strings.EqualFold(g, required) {
			return true
		}
		// prefix: test:* covers test:read
		if strings.HasSuffix(g, ":*") {
			prefix := strings.TrimSuffix(g, "*")
			if strings.HasPrefix(required, prefix) {
				return true
			}
		}
	}
	return false
}

// ── 11.39–11.45 SSO / SCIM stubs ────────────────────────────────────────────

type SSOConfig struct {
	Provider     string   `json:"provider"` // oidc|saml|azure|okta
	Issuer       string   `json:"issuer"`
	ClientID     string   `json:"clientId"`
	Scopes       []string `json:"scopes"`
	SCIMEnabled  bool     `json:"scimEnabled"`
	EnforceSSO   bool     `json:"enforceSso"`
}

func ValidateSSOConfig(c SSOConfig) (bool, []string) {
	issues := make([]string, 0)
	if c.Provider == "" {
		issues = append(issues, "provider required")
	}
	if c.Issuer == "" {
		issues = append(issues, "issuer required")
	}
	if c.ClientID == "" {
		issues = append(issues, "clientId required")
	}
	return len(issues) == 0, issues
}

type SCIMUser struct {
	ID        string `json:"id"`
	UserName  string `json:"userName"`
	Active    bool   `json:"active"`
	Email     string `json:"email"`
	ExternalID string `json:"externalId,omitempty"`
}

type SCIMStore struct {
	mu    sync.RWMutex
	users map[string]*SCIMUser
}

func NewSCIMStore() *SCIMStore {
	return &SCIMStore{users: make(map[string]*SCIMUser)}
}

func (s *SCIMStore) Upsert(u *SCIMUser) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID] = u
}

func (s *SCIMStore) List() []*SCIMUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*SCIMUser, 0, len(s.users))
	for _, u := range s.users {
		out = append(out, u)
	}
	return out
}

// ── 11.46–11.49 Usage metering ──────────────────────────────────────────────

type UsageEvent struct {
	TenantID  string    `json:"tenantId"`
	Metric    string    `json:"metric"` // vu_hours|api_calls|storage_gb
	Quantity  float64   `json:"quantity"`
	At        time.Time `json:"at"`
}

type MeterStore struct {
	mu     sync.Mutex
	events []UsageEvent
}

func NewMeterStore() *MeterStore {
	return &MeterStore{events: make([]UsageEvent, 0)}
}

func (m *MeterStore) Record(e UsageEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e.At.IsZero() {
		e.At = time.Now().UTC()
	}
	m.events = append(m.events, e)
	if len(m.events) > 10000 {
		m.events = m.events[len(m.events)-10000:]
	}
}

func (m *MeterStore) Aggregate(tenantID string) map[string]float64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	agg := map[string]float64{}
	for _, e := range m.events {
		if tenantID != "" && e.TenantID != tenantID {
			continue
		}
		agg[e.Metric] += e.Quantity
	}
	return agg
}

// ── 11.50 Catalog ───────────────────────────────────────────────────────────

func Phase11Catalog() []map[string]string {
	names := []string{
		"Tenant model", "Tenant upsert", "Tenant get", "Tenant list", "Tenant isolation check",
		"Default tenant seed", "Tenant plan field", "Tenant region", "Tenant status", "Tenant labels",
		"License model", "License validate VUs", "License expire", "License concurrent runs", "License features",
		"HasFeature helper", "Days remaining", "Missing license key", "Marketplace item model", "Marketplace list",
		"Marketplace filter kind", "Marketplace filter tag", "Marketplace install", "Marketplace publish", "Marketplace downloads",
		"Marketplace seed scripts", "Marketplace connectors", "API product tiers", "Tier for plan", "Scope allow exact",
		"Scope allow wildcard", "Scope deny", "Free tier limits", "Enterprise unlimited daily", "SSO config model",
		"SSO validate issuer", "SSO enforce flag", "SCIM enabled", "SCIM user upsert", "SCIM list users",
		"Usage event model", "Meter record", "Meter aggregate", "Meter tenant filter", "Meter vu_hours",
		"API calls metric", "Storage metric", "SaaS isolation summary", "License+tenant gate", "Phase 11 catalog",
	}
	items := make([]map[string]string, 0, 50)
	for i, n := range names {
		items = append(items, map[string]string{"id": fmt.Sprintf("11.%d", i+1), "name": n})
	}
	return items
}
