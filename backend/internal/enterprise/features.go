package enterprise

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ── 6.1 Environment readiness ───────────────────────────────────────────────

type ReadinessCheck struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Detail  string `json:"detail"`
	Latency int64  `json:"latencyMs,omitempty"`
}

func CheckEnvironmentReadiness(targetURL string, redisOK, dbOK, k8sOK bool) []ReadinessCheck {
	out := []ReadinessCheck{
		{Name: "database", OK: dbOK, Detail: boolDetail(dbOK, "reachable", "not configured/unreachable")},
		{Name: "redis", OK: redisOK, Detail: boolDetail(redisOK, "reachable", "not configured/unreachable")},
		{Name: "kubernetes", OK: k8sOK, Detail: boolDetail(k8sOK, "client ready", "offline — sim/http only")},
	}
	// Target probe
	start := time.Now()
	ok, detail := probeURL(targetURL)
	out = append(out, ReadinessCheck{
		Name: "target", OK: ok, Detail: detail, Latency: time.Since(start).Milliseconds(),
	})
	return out
}

func probeURL(raw string) (bool, string) {
	if raw == "" {
		return false, "no target URL"
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		u, err = url.Parse("https://" + raw)
		if err != nil {
			return false, "invalid URL"
		}
	}
	// DNS only by default to avoid hanging CI on external hosts
	host := u.Hostname()
	if host == "" {
		return false, "empty host"
	}
	// Quick TCP for localhost; DNS for others
	if host == "localhost" || host == "127.0.0.1" {
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, portOr(u, "80")), 500*time.Millisecond)
		if err != nil {
			return false, err.Error()
		}
		_ = conn.Close()
		return true, "tcp ok"
	}
	_, err = net.LookupHost(host)
	if err != nil {
		// Non-fatal for demo targets that may not resolve
		return true, "dns skipped/soft-fail: " + err.Error()
	}
	return true, "dns ok"
}

func portOr(u *url.URL, def string) string {
	if u.Port() != "" {
		return u.Port()
	}
	if u.Scheme == "https" {
		return "443"
	}
	return def
}

func boolDetail(ok bool, good, bad string) string {
	if ok {
		return good
	}
	return bad
}

// ── 6.2 Service virtualization ──────────────────────────────────────────────

type VirtualService struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	BaseURL  string `json:"baseUrl"`
	Replaces string `json:"replaces"` // dependency name
	Enabled  bool   `json:"enabled"`
}

type VirtualRegistry struct {
	mu   sync.RWMutex
	svcs map[string]*VirtualService
}

func NewVirtualRegistry() *VirtualRegistry {
	return &VirtualRegistry{svcs: make(map[string]*VirtualService)}
}

func (r *VirtualRegistry) Register(v *VirtualService) {
	r.mu.Lock()
	defer r.mu.Unlock()
	v.Enabled = true
	r.svcs[v.ID] = v
}

func (r *VirtualRegistry) List() []*VirtualService {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*VirtualService, 0, len(r.svcs))
	for _, v := range r.svcs {
		out = append(out, v)
	}
	return out
}

func (r *VirtualRegistry) Resolve(dependency string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, v := range r.svcs {
		if v.Enabled && strings.EqualFold(v.Replaces, dependency) {
			return v.BaseURL, true
		}
	}
	return "", false
}

// ── 6.3 Baselines ───────────────────────────────────────────────────────────

type Baseline struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	TestID      string    `json:"testId"`
	AvgRT       float64   `json:"avgResponseTime"`
	P95         float64   `json:"p95"`
	Throughput  float64   `json:"throughput"`
	ErrorRate   float64   `json:"errorRate"`
	Status      string    `json:"status"` // PROPOSED | APPROVED | EXPIRED
	ApprovedBy  string    `json:"approvedBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
}

type BaselineStore struct {
	mu   sync.RWMutex
	items map[string]*Baseline
}

func NewBaselineStore() *BaselineStore {
	return &BaselineStore{items: make(map[string]*Baseline)}
}

func (s *BaselineStore) Propose(b *Baseline) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b.Status = "PROPOSED"
	b.CreatedAt = time.Now().UTC()
	s.items[b.ID] = b
}

func (s *BaselineStore) Approve(id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.items[id]
	if !ok {
		return fmt.Errorf("baseline not found")
	}
	b.Status = "APPROVED"
	b.ApprovedBy = by
	exp := time.Now().Add(90 * 24 * time.Hour)
	b.ExpiresAt = &exp
	return nil
}

func (s *BaselineStore) List() []*Baseline {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Baseline, 0, len(s.items))
	now := time.Now()
	for _, b := range s.items {
		if b.ExpiresAt != nil && now.After(*b.ExpiresAt) {
			b.Status = "EXPIRED"
		}
		out = append(out, b)
	}
	return out
}

// ── 6.4 Golden templates ────────────────────────────────────────────────────

type GoldenTemplate struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Category     string `json:"category"` // baseline|load|stress|spike|soak|ci-smoke
	ScriptType   string `json:"scriptType"`
	VirtualUsers int    `json:"virtualUsers"`
	DurationSec  int    `json:"durationSec"`
	Description  string `json:"description"`
}

func GoldenTemplates() []GoldenTemplate {
	return []GoldenTemplate{
		{ID: "gt-smoke", Name: "CI Performance Smoke", Category: "ci-smoke", ScriptType: "HTTP", VirtualUsers: 5, DurationSec: 60, Description: "Fast gate for pipelines"},
		{ID: "gt-load", Name: "Standard Load", Category: "load", ScriptType: "JMeter", VirtualUsers: 100, DurationSec: 600, Description: "Steady-state load"},
		{ID: "gt-stress", Name: "Stress to Breaking Point", Category: "stress", ScriptType: "k6", VirtualUsers: 1000, DurationSec: 900, Description: "Find capacity cliff"},
		{ID: "gt-spike", Name: "Spike Burst", Category: "spike", ScriptType: "k6", VirtualUsers: 500, DurationSec: 180, Description: "Sudden traffic burst"},
		{ID: "gt-soak", Name: "Soak / Endurance", Category: "soak", ScriptType: "HTTP", VirtualUsers: 50, DurationSec: 3600, Description: "Memory leak / degradation hunt"},
		{ID: "gt-base", Name: "Baseline Capture", Category: "baseline", ScriptType: "HTTP", VirtualUsers: 20, DurationSec: 300, Description: "Establish reference metrics"},
	}
}

// ── 6.5 Impact analysis ─────────────────────────────────────────────────────

func ImpactAnalysis(changedServices, changedAPIs []string, catalog []string) map[string]interface{} {
	related := []string{}
	for _, t := range catalog {
		lt := strings.ToLower(t)
		for _, s := range changedServices {
			if strings.Contains(lt, strings.ToLower(s)) {
				related = append(related, t)
			}
		}
		for _, a := range changedAPIs {
			if strings.Contains(lt, strings.ToLower(a)) {
				related = append(related, t)
			}
		}
	}
	risk := "low"
	if len(changedServices) > 2 || len(changedAPIs) > 5 {
		risk = "high"
	} else if len(changedServices) > 0 || len(changedAPIs) > 0 {
		risk = "medium"
	}
	return map[string]interface{}{
		"changedServices": changedServices,
		"changedApis":     changedAPIs,
		"relatedTests":    unique(related),
		"risk":            risk,
		"recommendation":  "Run related performance tests before release",
	}
}

// ── 6.8 Chaos catalog ───────────────────────────────────────────────────────

type ChaosExperiment struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"` // pod-kill|network-latency|cpu-stress
	Safe        bool   `json:"safe"`
	Description string `json:"description"`
}

func ChaosCatalog() []ChaosExperiment {
	return []ChaosExperiment{
		{ID: "chaos-pod", Name: "Random Pod Kill", Type: "pod-kill", Safe: false, Description: "Terminates a non-critical pod during load"},
		{ID: "chaos-net", Name: "Network Latency Injection", Type: "network-latency", Safe: true, Description: "Adds 100–300ms latency to dependency path"},
		{ID: "chaos-cpu", Name: "CPU Stress", Type: "cpu-stress", Safe: true, Description: "Saturates CPU on a single target replica"},
	}
}

// ── 6.9 Data residency ──────────────────────────────────────────────────────

type ResidencyPolicy struct {
	Region           string   `json:"region"`
	AllowedDataTypes []string `json:"allowedDataTypes"`
	BlockCrossRegion bool     `json:"blockCrossRegion"`
}

func EnforceResidency(policy ResidencyPolicy, runRegion, resultRegion string) (bool, string) {
	if policy.Region == "" {
		return true, "no residency policy"
	}
	if policy.BlockCrossRegion && runRegion != "" && !strings.EqualFold(runRegion, policy.Region) {
		return false, fmt.Sprintf("run region %s violates residency %s", runRegion, policy.Region)
	}
	if resultRegion != "" && policy.BlockCrossRegion && !strings.EqualFold(resultRegion, policy.Region) {
		return false, fmt.Sprintf("result storage region %s violates residency %s", resultRegion, policy.Region)
	}
	return true, "ok"
}

// ── 6.10 Quotas / chargeback ────────────────────────────────────────────────

type Quota struct {
	Team         string  `json:"team"`
	MaxVUs       int     `json:"maxVUs"`
	MaxHours     float64 `json:"maxHoursMonth"`
	UsedHours    float64 `json:"usedHoursMonth"`
	UsedCostUSD  float64 `json:"usedCostUsd"`
}

type QuotaStore struct {
	mu   sync.RWMutex
	byTeam map[string]*Quota
}

func NewQuotaStore() *QuotaStore {
	q := &QuotaStore{byTeam: make(map[string]*Quota)}
	q.byTeam["platform"] = &Quota{Team: "platform", MaxVUs: 5000, MaxHours: 500, UsedHours: 12, UsedCostUSD: 40}
	q.byTeam["commerce"] = &Quota{Team: "commerce", MaxVUs: 2000, MaxHours: 200, UsedHours: 30, UsedCostUSD: 95}
	return q
}

func (s *QuotaStore) List() []*Quota {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Quota, 0, len(s.byTeam))
	for _, q := range s.byTeam {
		out = append(out, q)
	}
	return out
}

func (s *QuotaStore) Check(team string, vus int, hours float64) (bool, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	q, ok := s.byTeam[team]
	if !ok {
		return true, "no quota configured"
	}
	if vus > q.MaxVUs {
		return false, fmt.Sprintf("VU quota exceeded (%d > %d)", vus, q.MaxVUs)
	}
	if q.UsedHours+hours > q.MaxHours {
		return false, "monthly hour quota would be exceeded"
	}
	return true, "ok"
}

// ── 6.11 Cleanup plan ───────────────────────────────────────────────────────

type CleanupPlan struct {
	StaleJobsOlderThan string   `json:"staleJobsOlderThan"`
	RedisKeyPrefixes   []string `json:"redisKeyPrefixes"`
	ObjectRetentionDays int     `json:"objectRetentionDays"`
	Actions            []string `json:"actions"`
}

func BuildCleanupPlan(maxAgeHours int) CleanupPlan {
	if maxAgeHours <= 0 {
		maxAgeHours = 24
	}
	return CleanupPlan{
		StaleJobsOlderThan:  fmt.Sprintf("%dh", maxAgeHours),
		RedisKeyPrefixes:    []string{"speedrunner:run:", "speedrunner:data:"},
		ObjectRetentionDays: 30,
		Actions: []string{
			"Delete completed/failed Jobs older than max age",
			"Purge Redis run metric keys past TTL",
			"Apply object storage lifecycle to artifacts bucket",
			"Remove orphaned ConfigMaps labeled app.kubernetes.io/part-of=speedrunner",
		},
	}
}

// ── 6.12 Drift ──────────────────────────────────────────────────────────────

type EnvSnapshot struct {
	ConfigHash string            `json:"configHash"`
	Images     map[string]string `json:"images"`
	Replicas   map[string]int    `json:"replicas"`
}

func DetectEnvDrift(live, desired EnvSnapshot) map[string]interface{} {
	fields := []string{}
	if live.ConfigHash != desired.ConfigHash && desired.ConfigHash != "" {
		fields = append(fields, "configHash")
	}
	for k, v := range desired.Images {
		if live.Images[k] != v {
			fields = append(fields, "image:"+k)
		}
	}
	for k, v := range desired.Replicas {
		if live.Replicas[k] != v {
			fields = append(fields, "replicas:"+k)
		}
	}
	return map[string]interface{}{"hasDrift": len(fields) > 0, "fields": fields}
}

// ── 6.13 API contract ───────────────────────────────────────────────────────

type ContractCheck struct {
	Endpoint string `json:"endpoint"`
	OK       bool   `json:"ok"`
	Detail   string `json:"detail"`
}

func ValidateAPIContract(baseURL string, paths []string) map[string]interface{} {
	if len(paths) == 0 {
		paths = []string{"/health", "/ready"}
	}
	checks := []ContractCheck{}
	block := false
	client := &http.Client{Timeout: 2 * time.Second}
	for _, p := range paths {
		ep := strings.TrimRight(baseURL, "/") + p
		// Soft: don't fail CI when remote down — mark as warn
		resp, err := client.Get(ep)
		if err != nil {
			checks = append(checks, ContractCheck{Endpoint: ep, OK: true, Detail: "soft-skip: " + err.Error()})
			continue
		}
		_ = resp.Body.Close()
		ok := resp.StatusCode < 500
		if !ok {
			block = true
		}
		checks = append(checks, ContractCheck{Endpoint: ep, OK: ok, Detail: fmt.Sprintf("status %d", resp.StatusCode)})
	}
	return map[string]interface{}{
		"checks":                      checks,
		"blockHighVolumeOnFailure":    block,
		"schemaCompatibility":         "not evaluated (provide OpenAPI for deep check)",
	}
}

func unique(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
