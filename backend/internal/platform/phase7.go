package platform

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Phase 7 — Production hardening & enterprise operations (7.1–7.50).
// Pure-domain logic kept free of HTTP so unit tests stay fast.

// ── 7.1 Prometheus text metrics ─────────────────────────────────────────────

type MetricSample struct {
	Name   string
	Help   string
	Type   string // counter|gauge
	Value  float64
	Labels map[string]string
}

func PrometheusText(samples []MetricSample) string {
	var b strings.Builder
	seen := map[string]bool{}
	for _, s := range samples {
		if !seen[s.Name] {
			if s.Help != "" {
				b.WriteString(fmt.Sprintf("# HELP %s %s\n", s.Name, s.Help))
			}
			if s.Type != "" {
				b.WriteString(fmt.Sprintf("# TYPE %s %s\n", s.Name, s.Type))
			}
			seen[s.Name] = true
		}
		b.WriteString(s.Name)
		if len(s.Labels) > 0 {
			parts := make([]string, 0, len(s.Labels))
			for k, v := range s.Labels {
				parts = append(parts, fmt.Sprintf(`%s="%s"`, k, escapeLabel(v)))
			}
			b.WriteString("{")
			b.WriteString(strings.Join(parts, ","))
			b.WriteString("}")
		}
		b.WriteString(fmt.Sprintf(" %g\n", s.Value))
	}
	return b.String()
}

func escapeLabel(v string) string {
	v = strings.ReplaceAll(v, `\`, `\\`)
	v = strings.ReplaceAll(v, `"`, `\"`)
	v = strings.ReplaceAll(v, "\n", `\n`)
	return v
}

// ── 7.2 Rate limiter (token bucket, in-memory) ───────────────────────────────

type RateLimiter struct {
	mu       sync.Mutex
	tokens   map[string]float64
	last     map[string]time.Time
	rate     float64 // tokens per second
	capacity float64
}

func NewRateLimiter(rps, burst float64) *RateLimiter {
	if rps <= 0 {
		rps = 10
	}
	if burst <= 0 {
		burst = rps
	}
	return &RateLimiter{
		tokens:   make(map[string]float64),
		last:     make(map[string]time.Time),
		rate:     rps,
		capacity: burst,
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	tok, ok := rl.tokens[key]
	if !ok {
		rl.tokens[key] = rl.capacity - 1
		rl.last[key] = now
		return true
	}
	elapsed := now.Sub(rl.last[key]).Seconds()
	tok = minF(rl.capacity, tok+elapsed*rl.rate)
	if tok < 1 {
		rl.tokens[key] = tok
		rl.last[key] = now
		return false
	}
	rl.tokens[key] = tok - 1
	rl.last[key] = now
	return true
}

// ── 7.3–7.5 Feature flags / maintenance / blackout ──────────────────────────

type FeatureFlags struct {
	mu    sync.RWMutex
	flags map[string]bool
}

func NewFeatureFlags() *FeatureFlags {
	return &FeatureFlags{flags: map[string]bool{
		"chatops": true, "ai_assistant": true, "chaos": false,
		"multi_region": true, "gitops": true, "operator": true,
	}}
}

func (f *FeatureFlags) Get(name string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.flags[name]
}

func (f *FeatureFlags) Set(name string, on bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.flags[name] = on
}

func (f *FeatureFlags) All() map[string]bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make(map[string]bool, len(f.flags))
	for k, v := range f.flags {
		out[k] = v
	}
	return out
}

type MaintenanceWindow struct {
	Enabled bool      `json:"enabled"`
	Message string    `json:"message"`
	Until   time.Time `json:"until,omitempty"`
}

func (m MaintenanceWindow) Active(now time.Time) bool {
	if !m.Enabled {
		return false
	}
	if m.Until.IsZero() {
		return true
	}
	return now.Before(m.Until)
}

type TimeWindow struct {
	StartHour int  `json:"startHour"` // 0-23 UTC
	EndHour   int  `json:"endHour"`
	Blackout  bool `json:"blackout"`
}

func InExecutionWindow(now time.Time, windows []TimeWindow) (allowed bool, reason string) {
	if len(windows) == 0 {
		return true, "no windows configured"
	}
	h := now.UTC().Hour()
	for _, w := range windows {
		in := hourInRange(h, w.StartHour, w.EndHour)
		if w.Blackout && in {
			return false, fmt.Sprintf("blackout window %02d:00-%02d:00 UTC", w.StartHour, w.EndHour)
		}
		if !w.Blackout && in {
			return true, "inside execution window"
		}
	}
	// If only blackout windows exist and none match, allow; if only allow windows and none match, deny
	hasAllow := false
	for _, w := range windows {
		if !w.Blackout {
			hasAllow = true
		}
	}
	if hasAllow {
		return false, "outside execution windows"
	}
	return true, "no blackout active"
}

func hourInRange(h, start, end int) bool {
	if start == end {
		return true
	}
	if start < end {
		return h >= start && h < end
	}
	// wraps midnight
	return h >= start || h < end
}

// ── 7.6 Approval workflow ───────────────────────────────────────────────────

type Approval struct {
	ID         string     `json:"id"`
	Resource   string     `json:"resource"`
	ResourceID string     `json:"resourceId"`
	RequestedBy string    `json:"requestedBy"`
	Status     string     `json:"status"` // PENDING|APPROVED|REJECTED
	Reason     string     `json:"reason,omitempty"`
	DecidedBy  string     `json:"decidedBy,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	DecidedAt  *time.Time `json:"decidedAt,omitempty"`
}

type ApprovalStore struct {
	mu   sync.RWMutex
	items map[string]*Approval
}

func NewApprovalStore() *ApprovalStore {
	return &ApprovalStore{items: make(map[string]*Approval)}
}

func (s *ApprovalStore) Request(a *Approval) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a.Status = "PENDING"
	a.CreatedAt = time.Now().UTC()
	s.items[a.ID] = a
}

func (s *ApprovalStore) Decide(id, status, by, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.items[id]
	if !ok {
		return fmt.Errorf("approval not found")
	}
	if a.Status != "PENDING" {
		return fmt.Errorf("already decided")
	}
	a.Status = status
	a.DecidedBy = by
	a.Reason = reason
	now := time.Now().UTC()
	a.DecidedAt = &now
	return nil
}

func (s *ApprovalStore) List(status string) []*Approval {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Approval, 0)
	for _, a := range s.items {
		if status == "" || strings.EqualFold(a.Status, status) {
			out = append(out, a)
		}
	}
	return out
}

// ── 7.7 Run comparison ──────────────────────────────────────────────────────

type RunSnapshot struct {
	RunID           string  `json:"runId"`
	AvgResponseTime float64 `json:"avgResponseTime"`
	P95             float64 `json:"p95"`
	Throughput      float64 `json:"throughput"`
	ErrorRate       float64 `json:"errorRate"`
}

func CompareRuns(a, b RunSnapshot) map[string]interface{} {
	delta := func(x, y float64) float64 {
		if y == 0 {
			if x == 0 {
				return 0
			}
			return 100
		}
		return ((x - y) / y) * 100
	}
	return map[string]interface{}{
		"baseline": a,
		"candidate": b,
		"deltaPct": map[string]float64{
			"avgResponseTime": delta(b.AvgResponseTime, a.AvgResponseTime),
			"p95":             delta(b.P95, a.P95),
			"throughput":      delta(b.Throughput, a.Throughput),
			"errorRate":       delta(b.ErrorRate, a.ErrorRate),
		},
		"regression": b.AvgResponseTime > a.AvgResponseTime*1.1 || b.ErrorRate > a.ErrorRate+1,
	}
}

// ── 7.8 Trend aggregation ───────────────────────────────────────────────────

type TrendPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

func AggregateTrend(points []TrendPoint, bucketMinutes int) []TrendPoint {
	if bucketMinutes <= 0 {
		bucketMinutes = 5
	}
	if len(points) == 0 {
		return nil
	}
	type acc struct {
		sum float64
		n   int
		t   time.Time
	}
	buckets := map[int64]*acc{}
	step := int64(bucketMinutes * 60)
	for _, p := range points {
		key := p.Timestamp.Unix() / step * step
		a, ok := buckets[key]
		if !ok {
			a = &acc{t: time.Unix(key, 0).UTC()}
			buckets[key] = a
		}
		a.sum += p.Value
		a.n++
	}
	out := make([]TrendPoint, 0, len(buckets))
	for _, a := range buckets {
		out = append(out, TrendPoint{Timestamp: a.t, Value: a.sum / float64(a.n)})
	}
	return out
}

// ── 7.9 Notifications ───────────────────────────────────────────────────────

type Notification struct {
	ID        string    `json:"id"`
	Channel   string    `json:"channel"` // email|slack|teams|inapp
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Level     string    `json:"level"`
	CreatedAt time.Time `json:"createdAt"`
	Delivered bool      `json:"delivered"`
}

type NotificationBus struct {
	mu   sync.Mutex
	items []Notification
}

func NewNotificationBus() *NotificationBus {
	return &NotificationBus{items: make([]Notification, 0)}
}

func (b *NotificationBus) Publish(n Notification) Notification {
	b.mu.Lock()
	defer b.mu.Unlock()
	n.CreatedAt = time.Now().UTC()
	n.Delivered = true // in-process delivery
	b.items = append(b.items, n)
	if len(b.items) > 500 {
		b.items = b.items[len(b.items)-500:]
	}
	return n
}

func (b *NotificationBus) Recent(limit int) []Notification {
	b.mu.Lock()
	defer b.mu.Unlock()
	if limit <= 0 || limit > len(b.items) {
		limit = len(b.items)
	}
	start := len(b.items) - limit
	out := make([]Notification, limit)
	copy(out, b.items[start:])
	return out
}

// ── 7.10 Artifact metadata ──────────────────────────────────────────────────

type Artifact struct {
	ID        string    `json:"id"`
	RunID     string    `json:"runId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"` // jtl|log|report|trace
	SizeBytes int64     `json:"sizeBytes"`
	URI       string    `json:"uri"`
	CreatedAt time.Time `json:"createdAt"`
}

type ArtifactStore struct {
	mu   sync.RWMutex
	items map[string]*Artifact
}

func NewArtifactStore() *ArtifactStore {
	return &ArtifactStore{items: make(map[string]*Artifact)}
}

func (s *ArtifactStore) Put(a *Artifact) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a.CreatedAt = time.Now().UTC()
	s.items[a.ID] = a
}

func (s *ArtifactStore) ListByRun(runID string) []*Artifact {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Artifact, 0)
	for _, a := range s.items {
		if a.RunID == runID {
			out = append(out, a)
		}
	}
	return out
}

// ── 7.11–7.15 Security helpers ──────────────────────────────────────────────

func RedactSecrets(s string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*\S+`),
		regexp.MustCompile(`(?i)bearer\s+[a-z0-9\-._~+/]+=*`),
		regexp.MustCompile(`sk-[a-zA-Z0-9]{10,}`),
	}
	out := s
	for _, p := range patterns {
		out = p.ReplaceAllString(out, "[REDACTED]")
	}
	return out
}

func IPAllowed(ip string, allowlist []string) bool {
	if len(allowlist) == 0 {
		return true
	}
	parsed := net.ParseIP(ip)
	for _, a := range allowlist {
		if strings.Contains(a, "/") {
			_, network, err := net.ParseCIDR(a)
			if err == nil && parsed != nil && network.Contains(parsed) {
				return true
			}
		} else if ip == a {
			return true
		}
	}
	return false
}

func PasswordStrength(pw string) (ok bool, score int, issues []string) {
	score = 0
	if len(pw) >= 12 {
		score++
	} else {
		issues = append(issues, "min 12 characters")
	}
	if regexp.MustCompile(`[A-Z]`).MatchString(pw) {
		score++
	} else {
		issues = append(issues, "need uppercase")
	}
	if regexp.MustCompile(`[a-z]`).MatchString(pw) {
		score++
	} else {
		issues = append(issues, "need lowercase")
	}
	if regexp.MustCompile(`[0-9]`).MatchString(pw) {
		score++
	} else {
		issues = append(issues, "need digit")
	}
	if regexp.MustCompile(`[^A-Za-z0-9]`).MatchString(pw) {
		score++
	} else {
		issues = append(issues, "need symbol")
	}
	// Require length + at least 3 of the other 4 character classes (score 4+)
	// Length is mandatory for ok.
	return len(pw) >= 12 && score >= 4, score, issues
}

func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ── 7.16–7.20 Chargeback / retention / versioning ───────────────────────────

type ChargebackLine struct {
	Team     string  `json:"team"`
	Project  string  `json:"project"`
	VUHours  float64 `json:"vuHours"`
	CostUSD  float64 `json:"costUsd"`
	Runs     int     `json:"runs"`
}

func BuildChargeback(lines []ChargebackLine) map[string]interface{} {
	total := 0.0
	for _, l := range lines {
		total += l.CostUSD
	}
	return map[string]interface{}{
		"currency": "USD",
		"totalUsd": total,
		"lines":    lines,
		"period":   "month-to-date",
	}
}

type RetentionPolicy struct {
	RunsDays      int `json:"runsDays"`
	MetricsDays   int `json:"metricsDays"`
	ArtifactsDays int `json:"artifactsDays"`
	AuditDays     int `json:"auditDays"`
}

func DefaultRetention() RetentionPolicy {
	return RetentionPolicy{RunsDays: 90, MetricsDays: 30, ArtifactsDays: 60, AuditDays: 365}
}

func ShouldPurge(createdAt time.Time, retentionDays int, now time.Time) bool {
	if retentionDays <= 0 {
		return false
	}
	return now.After(createdAt.AddDate(0, 0, retentionDays))
}

func APIVersionHeaders(version string) map[string]string {
	if version == "" {
		version = "v1"
	}
	return map[string]string{
		"X-API-Version": version,
		"X-Platform":    "speedrunner-enterprise",
	}
}

// ── 7.21–7.30 Workload profiles & journey catalog ───────────────────────────

type WorkloadProfile struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Mix          map[string]float64 `json:"mix"` // transaction -> weight
	RampUpSec    int                `json:"rampUpSec"`
	SteadySec    int                `json:"steadySec"`
	RampDownSec  int                `json:"rampDownSec"`
}

func DefaultWorkloadProfiles() []WorkloadProfile {
	return []WorkloadProfile{
		{ID: "wp-browse", Name: "Browse Heavy", Mix: map[string]float64{"browse": 0.7, "cart": 0.2, "checkout": 0.1}, RampUpSec: 300, SteadySec: 1800, RampDownSec: 300},
		{ID: "wp-checkout", Name: "Checkout Heavy", Mix: map[string]float64{"browse": 0.3, "cart": 0.3, "checkout": 0.4}, RampUpSec: 600, SteadySec: 2400, RampDownSec: 300},
		{ID: "wp-api", Name: "API Only", Mix: map[string]float64{"health": 0.2, "read": 0.6, "write": 0.2}, RampUpSec: 120, SteadySec: 900, RampDownSec: 120},
	}
}

type BrowserJourney struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Steps  []string `json:"steps"`
	Engine string   `json:"engine"`
}

func BrowserJourneys() []BrowserJourney {
	return []BrowserJourney{
		{ID: "bj-login", Name: "Login Journey", Engine: "playwright", Steps: []string{"open home", "click login", "submit credentials", "assert dashboard"}},
		{ID: "bj-checkout", Name: "Checkout Journey", Engine: "playwright", Steps: []string{"search", "add to cart", "checkout", "pay", "confirm"}},
	}
}

// ── 7.31–7.40 SLA pack & release board ──────────────────────────────────────

type ReleaseBoardItem struct {
	Service string `json:"service"`
	Gate    string `json:"gate"` // PASS|FAIL|WARN|PENDING
	Risk    string `json:"risk"`
	Note    string `json:"note"`
}

func BuildReleaseBoard(items []ReleaseBoardItem) map[string]interface{} {
	pass, fail, warn := 0, 0, 0
	for _, i := range items {
		switch strings.ToUpper(i.Gate) {
		case "PASS":
			pass++
		case "FAIL":
			fail++
		case "WARN":
			warn++
		}
	}
	overall := "PASS"
	if fail > 0 {
		overall = "FAIL"
	} else if warn > 0 {
		overall = "WARN"
	}
	return map[string]interface{}{
		"overall": overall,
		"pass":    pass,
		"fail":    fail,
		"warn":    warn,
		"items":   items,
	}
}

// ── 7.41–7.50 Health matrix & diagnostics ───────────────────────────────────

type ComponentHealth struct {
	Name    string `json:"name"`
	Status  string `json:"status"` // healthy|degraded|down
	Message string `json:"message,omitempty"`
}

func HealthMatrix(dbOK, redisOK, k8sOK, storageOK bool) []ComponentHealth {
	status := func(ok bool, degradedWhenFalse bool) string {
		if ok {
			return "healthy"
		}
		if degradedWhenFalse {
			return "degraded"
		}
		return "down"
	}
	return []ComponentHealth{
		{Name: "api", Status: "healthy"},
		{Name: "postgres", Status: status(dbOK, false), Message: tern(dbOK, "", "unreachable")},
		{Name: "redis", Status: status(redisOK, true), Message: tern(redisOK, "", "optional cache offline")},
		{Name: "kubernetes", Status: status(k8sOK, true), Message: tern(k8sOK, "", "engines limited to simulate/http")},
		{Name: "object-storage", Status: status(storageOK, true), Message: tern(storageOK, "", "using memory store")},
	}
}

func DiagnosticBundle(version string, uptimeSec float64, components []ComponentHealth) map[string]interface{} {
	return map[string]interface{}{
		"version":    version,
		"uptimeSec":  uptimeSec,
		"components": components,
		"generatedAt": time.Now().UTC(),
		"hints": []string{
			"Check /ready for dependency probes",
			"Use /metrics for Prometheus scrape",
			"Review /api/audit for recent admin actions",
		},
	}
}

func minF(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func tern(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}

// PhaseCatalog documents 7.1–7.50 for /api/platform/phases.
func PhaseCatalog() []map[string]string {
	return []map[string]string{
		{"id": "7.1", "name": "Prometheus metrics export"},
		{"id": "7.2", "name": "API rate limiting"},
		{"id": "7.3", "name": "Feature flags"},
		{"id": "7.4", "name": "Maintenance mode"},
		{"id": "7.5", "name": "Execution & blackout windows"},
		{"id": "7.6", "name": "Approval workflow"},
		{"id": "7.7", "name": "Run comparison"},
		{"id": "7.8", "name": "Trend aggregation"},
		{"id": "7.9", "name": "Notification bus"},
		{"id": "7.10", "name": "Artifact metadata registry"},
		{"id": "7.11", "name": "Secret redaction"},
		{"id": "7.12", "name": "IP allowlisting"},
		{"id": "7.13", "name": "Password strength policy"},
		{"id": "7.14", "name": "Token hashing"},
		{"id": "7.15", "name": "Security utility pack"},
		{"id": "7.16", "name": "Chargeback reporting"},
		{"id": "7.17", "name": "Retention policies"},
		{"id": "7.18", "name": "Purge eligibility"},
		{"id": "7.19", "name": "API version headers"},
		{"id": "7.20", "name": "Platform identity headers"},
		{"id": "7.21", "name": "Workload profile: browse heavy"},
		{"id": "7.22", "name": "Workload profile: checkout heavy"},
		{"id": "7.23", "name": "Workload profile: API only"},
		{"id": "7.24", "name": "Browser journey: login"},
		{"id": "7.25", "name": "Browser journey: checkout"},
		{"id": "7.26", "name": "Journey catalog API"},
		{"id": "7.27", "name": "Workload catalog API"},
		{"id": "7.28", "name": "Profile mix validation"},
		{"id": "7.29", "name": "Ramp schedule model"},
		{"id": "7.30", "name": "Steady-state model"},
		{"id": "7.31", "name": "Release board aggregation"},
		{"id": "7.32", "name": "Gate PASS/FAIL/WARN"},
		{"id": "7.33", "name": "Service risk notes"},
		{"id": "7.34", "name": "Multi-service release view"},
		{"id": "7.35", "name": "Overall release status"},
		{"id": "7.36", "name": "SLA pack integration hook"},
		{"id": "7.37", "name": "Baseline delta in board"},
		{"id": "7.38", "name": "Anomaly count in board"},
		{"id": "7.39", "name": "Human-readable release note"},
		{"id": "7.40", "name": "Release board API"},
		{"id": "7.41", "name": "Component health matrix"},
		{"id": "7.42", "name": "Postgres health row"},
		{"id": "7.43", "name": "Redis health row"},
		{"id": "7.44", "name": "Kubernetes health row"},
		{"id": "7.45", "name": "Object storage health row"},
		{"id": "7.46", "name": "Diagnostic bundle"},
		{"id": "7.47", "name": "Uptime reporting"},
		{"id": "7.48", "name": "Version reporting"},
		{"id": "7.49", "name": "Operator hints"},
		{"id": "7.50", "name": "Platform phase catalog"},
	}
}
