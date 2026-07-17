package platform

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 14 — Next 20 enterprise features (14.1–14.20).
// Focus: workspace templates, secrets rotation, run annotations, freeze windows,
// dependency graph, scorecards, experiment flags, audit export, webhook DLQ,
// test suite packs, env promotion, secret scan gate, and IP allowlists.

// ── 14.1 Workspace starter templates ────────────────────────────────────────

type WorkspaceTemplate struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Engines     []string `json:"engines"`
	DefaultVUs  int      `json:"defaultVUs"`
	Tags        []string `json:"tags"`
}

func WorkspaceTemplates() []WorkspaceTemplate {
	return []WorkspaceTemplate{
		{ID: "wt-api", Name: "API Load Pack", Description: "HTTP/k6 API smoke + soak", Engines: []string{"http", "k6"}, DefaultVUs: 100, Tags: []string{"api", "rest"}},
		{ID: "wt-web", Name: "Browser Journey Pack", Description: "Playwright critical paths", Engines: []string{"playwright"}, DefaultVUs: 20, Tags: []string{"browser", "ux"}},
		{ID: "wt-llm", Name: "LLM Stress Pack", Description: "OpenAI-compatible chat load", Engines: []string{"http", "k6"}, DefaultVUs: 50, Tags: []string{"llm", "ai"}},
		{ID: "wt-nightly", Name: "Nightly Regression", Description: "Scheduled multi-scenario suite", Engines: []string{"jmeter", "k6"}, DefaultVUs: 200, Tags: []string{"ci", "nightly"}},
	}
}

// ── 14.2–14.3 Secrets rotation schedule ─────────────────────────────────────

type SecretRotation struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	LastRotated time.Time `json:"lastRotated"`
	IntervalDays int     `json:"intervalDays"`
}

func SecretRotationDue(s SecretRotation, now time.Time) bool {
	if s.IntervalDays <= 0 {
		return false
	}
	return now.Sub(s.LastRotated) >= time.Duration(s.IntervalDays)*24*time.Hour
}

// ── 14.4–14.5 Run annotations / bookmarks ───────────────────────────────────

type RunAnnotation struct {
	ID        string    `json:"id"`
	RunID     string    `json:"runId"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	Tags      []string  `json:"tags,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type AnnotationStore struct {
	mu   sync.RWMutex
	data map[string][]RunAnnotation // runID -> notes
}

func NewAnnotationStore() *AnnotationStore {
	return &AnnotationStore{data: make(map[string][]RunAnnotation)}
}

func (a *AnnotationStore) Add(n RunAnnotation) RunAnnotation {
	a.mu.Lock()
	defer a.mu.Unlock()
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	a.data[n.RunID] = append(a.data[n.RunID], n)
	return n
}

func (a *AnnotationStore) List(runID string) []RunAnnotation {
	a.mu.RLock()
	defer a.mu.RUnlock()
	out := append([]RunAnnotation{}, a.data[runID]...)
	return out
}

// ── 14.6–14.7 Change freeze windows ─────────────────────────────────────────

type FreezeWindow struct {
	Name      string    `json:"name"`
	StartsAt  time.Time `json:"startsAt"`
	EndsAt    time.Time `json:"endsAt"`
	Scopes    []string  `json:"scopes"` // env names or *
	Reason    string    `json:"reason"`
}

func InFreezeWindow(now time.Time, windows []FreezeWindow, env string) (bool, string) {
	for _, w := range windows {
		if now.Before(w.StartsAt) || now.After(w.EndsAt) {
			continue
		}
		if len(w.Scopes) == 0 || containsStr(w.Scopes, "*") || containsStr(w.Scopes, env) {
			return true, w.Reason
		}
	}
	return false, ""
}

func containsStr(ss []string, v string) bool {
	for _, s := range ss {
		if strings.EqualFold(s, v) {
			return true
		}
	}
	return false
}

// ── 14.8–14.9 Service dependency graph ──────────────────────────────────────

type DependencyEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Type string `json:"type"` // http|db|cache|queue
}

func ImpactedServices(edges []DependencyEdge, changed string) []string {
	// BFS downstream from changed service
	adj := map[string][]string{}
	for _, e := range edges {
		adj[e.From] = append(adj[e.From], e.To)
	}
	seen := map[string]bool{changed: true}
	q := []string{changed}
	out := []string{}
	for len(q) > 0 {
		cur := q[0]
		q = q[1:]
		for _, n := range adj[cur] {
			if !seen[n] {
				seen[n] = true
				out = append(out, n)
				q = append(q, n)
			}
		}
	}
	sort.Strings(out)
	return out
}

// ── 14.10–14.11 Engineering scorecards ──────────────────────────────────────

type ScorecardInput struct {
	SLAPassRate   float64 `json:"slaPassRate"`   // 0-100
	MeanErrorRate float64 `json:"meanErrorRate"` // %
	P95TrendPct   float64 `json:"p95TrendPct"`   // negative is improvement
	CoveragePct   float64 `json:"coveragePct"`   // critical journeys covered
}

func EngineeringScore(in ScorecardInput) map[string]interface{} {
	// Weighted 0-100
	sla := math.Min(100, math.Max(0, in.SLAPassRate))
	errScore := math.Max(0, 100-in.MeanErrorRate*20)
	trendScore := 50 - in.P95TrendPct // improve when negative trend
	if trendScore < 0 {
		trendScore = 0
	}
	if trendScore > 100 {
		trendScore = 100
	}
	cov := math.Min(100, math.Max(0, in.CoveragePct))
	total := sla*0.4 + errScore*0.25 + trendScore*0.15 + cov*0.2
	grade := "C"
	switch {
	case total >= 90:
		grade = "A"
	case total >= 80:
		grade = "B"
	case total >= 70:
		grade = "C"
	case total >= 60:
		grade = "D"
	default:
		grade = "F"
	}
	return map[string]interface{}{
		"score": math.Round(total*10) / 10,
		"grade": grade,
		"parts": map[string]float64{"sla": sla, "errors": errScore, "trend": trendScore, "coverage": cov},
	}
}

// ── 14.12–14.13 Experiment / feature experiments ────────────────────────────

type Experiment struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Percent  int    `json:"percent"`
	Status   string `json:"status"` // draft|running|concluded
	VariantA string `json:"variantA"`
	VariantB string `json:"variantB"`
}

func ExperimentBucket(exp Experiment, userKey string) string {
	if exp.Status != "running" || exp.Percent <= 0 {
		return exp.VariantA
	}
	if exp.Percent >= 100 {
		return exp.VariantB
	}
	var h uint32
	for i := 0; i < len(userKey); i++ {
		h = h*31 + uint32(userKey[i])
	}
	if int(h%100) < exp.Percent {
		return exp.VariantB
	}
	return exp.VariantA
}

// ── 14.14 Audit export pack ─────────────────────────────────────────────────

func ExportAuditCSV(rows []map[string]string) string {
	var b strings.Builder
	b.WriteString("timestamp,actor,action,resource,ip\n")
	for _, r := range rows {
		b.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s\n",
			csvEsc(r["timestamp"]), csvEsc(r["actor"]), csvEsc(r["action"]),
			csvEsc(r["resource"]), csvEsc(r["ip"])))
	}
	return b.String()
}

func csvEsc(s string) string {
	if strings.ContainsAny(s, `",`) {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

// ── 14.15–14.16 Webhook dead-letter queue ───────────────────────────────────

type DeadLetter struct {
	ID        string    `json:"id"`
	Target    string    `json:"target"`
	Payload   string    `json:"payload"`
	LastError string    `json:"lastError"`
	Attempts  int       `json:"attempts"`
	FailedAt  time.Time `json:"failedAt"`
}

type DeadLetterQueue struct {
	mu    sync.Mutex
	items []DeadLetter
}

func NewDeadLetterQueue() *DeadLetterQueue {
	return &DeadLetterQueue{items: make([]DeadLetter, 0)}
}

func (d *DeadLetterQueue) Enqueue(item DeadLetter) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if item.FailedAt.IsZero() {
		item.FailedAt = time.Now().UTC()
	}
	d.items = append(d.items, item)
	if len(d.items) > 500 {
		d.items = d.items[len(d.items)-500:]
	}
}

func (d *DeadLetterQueue) List() []DeadLetter {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]DeadLetter, len(d.items))
	copy(out, d.items)
	return out
}

func (d *DeadLetterQueue) Requeue(id string) (*DeadLetter, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	for i, it := range d.items {
		if it.ID == id {
			out := it
			d.items = append(d.items[:i], d.items[i+1:]...)
			return &out, true
		}
	}
	return nil, false
}

// ── 14.17 Test suite packs ──────────────────────────────────────────────────

type SuitePack struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	TestIDs []string `json:"testIds"`
	Tags    []string `json:"tags"`
}

func SuitePackOrder(pack SuitePack, priority map[string]int) []string {
	ids := append([]string{}, pack.TestIDs...)
	sort.SliceStable(ids, func(i, j int) bool {
		return priority[ids[i]] > priority[ids[j]]
	})
	return ids
}

// ── 14.18 Environment promotion gates ───────────────────────────────────────

type PromotionRequest struct {
	FromEnv string  `json:"fromEnv"`
	ToEnv   string  `json:"toEnv"`
	SLAPass bool    `json:"slaPass"`
	ErrorRate float64 `json:"errorRate"`
	P95Ms   float64 `json:"p95Ms"`
	MaxError float64 `json:"maxError"`
	MaxP95  float64 `json:"maxP95"`
}

func EvaluatePromotion(p PromotionRequest) map[string]interface{} {
	if p.MaxError <= 0 {
		p.MaxError = 1
	}
	if p.MaxP95 <= 0 {
		p.MaxP95 = 500
	}
	ok := p.SLAPass && p.ErrorRate <= p.MaxError && p.P95Ms <= p.MaxP95
	reasons := []string{}
	if !p.SLAPass {
		reasons = append(reasons, "SLA not passed in source env")
	}
	if p.ErrorRate > p.MaxError {
		reasons = append(reasons, fmt.Sprintf("errorRate %.2f > %.2f", p.ErrorRate, p.MaxError))
	}
	if p.P95Ms > p.MaxP95 {
		reasons = append(reasons, fmt.Sprintf("p95 %.0f > %.0f", p.P95Ms, p.MaxP95))
	}
	return map[string]interface{}{
		"allowed": ok,
		"from":    p.FromEnv,
		"to":      p.ToEnv,
		"reasons": reasons,
	}
}

// ── 14.19 Pre-run secret scan gate ──────────────────────────────────────────

func SecretScanScript(script string) map[string]interface{} {
	findings := []string{}
	lower := strings.ToLower(script)
	patterns := []string{"password=", "api_key=", "apikey=", "secret=", "Bearer ", "AKIA"}
	for _, p := range patterns {
		if strings.Contains(lower, strings.ToLower(p)) || strings.Contains(script, p) {
			findings = append(findings, "possible secret pattern: "+p)
		}
	}
	return map[string]interface{}{
		"passed":   len(findings) == 0,
		"findings": findings,
		"count":    len(findings),
	}
}

// ── 14.20 IP allowlist enforcement ──────────────────────────────────────────

type IPAllowlist struct {
	CIDRs []string `json:"cidrs"` // also plain IPs
}

func IPAllowedByList(ip string, list IPAllowlist) bool {
	if len(list.CIDRs) == 0 {
		return true
	}
	for _, c := range list.CIDRs {
		if c == "*" || c == ip {
			return true
		}
		// simple CIDR-ish match for common prefixes (demo-grade, not full IP library)
		if strings.Contains(c, "/") {
			bits := strings.Split(c, "/")
			prefix := bits[0]
			mask := bits[1]
			parts := strings.Split(prefix, ".")
			ipParts := strings.Split(ip, ".")
			if len(parts) < 1 || len(ipParts) < 1 {
				continue
			}
			switch mask {
			case "8":
				if parts[0] == ipParts[0] {
					return true
				}
			case "16":
				if len(parts) >= 2 && len(ipParts) >= 2 && parts[0] == ipParts[0] && parts[1] == ipParts[1] {
					return true
				}
			case "24":
				if len(parts) >= 3 && len(ipParts) >= 3 && parts[0] == ipParts[0] && parts[1] == ipParts[1] && parts[2] == ipParts[2] {
					return true
				}
			default:
				if strings.HasPrefix(ip, strings.TrimSuffix(prefix, ".0")+".") || ip == prefix {
					return true
				}
			}
		}
	}
	return false
}

// Phase14Catalog documents 14.1–14.20.
func Phase14Catalog() []map[string]string {
	names := []string{
		"Workspace starter templates",
		"Secret rotation model",
		"Secret rotation due check",
		"Run annotation store",
		"Run annotation list",
		"Change freeze windows",
		"Freeze scope match",
		"Service dependency edges",
		"Impacted services BFS",
		"Engineering scorecard",
		"Scorecard grade A-F",
		"Experiment bucket A/B",
		"Experiment running only",
		"Audit CSV export",
		"Webhook dead-letter enqueue",
		"Dead-letter requeue",
		"Test suite pack ordering",
		"Environment promotion gate",
		"Pre-run secret scan",
		"IP allowlist enforcement",
	}
	items := make([]map[string]string, 0, 20)
	for i, n := range names {
		items = append(items, map[string]string{
			"id":   fmt.Sprintf("14.%d", i+1),
			"name": n,
		})
	}
	return items
}
