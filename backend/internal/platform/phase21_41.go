package platform

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Enterprise roadmap phases 21–41 — full-application depth capabilities.
// Catalog IDs are "21" … "41" (21 features) for tracking against the backlog.

// ── 21 Portfolio dashboard ──────────────────────────────────────────────────

type PortfolioProject struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	OpenRisks    int     `json:"openRisks"`
	SLAPassRate  float64 `json:"slaPassRate"`
	LastRunAt    string  `json:"lastRunAt,omitempty"`
	ActiveTests  int     `json:"activeTests"`
	HealthScore  float64 `json:"healthScore"`
}

func PortfolioSummary(projects []PortfolioProject) map[string]interface{} {
	total := len(projects)
	var risks int
	var slaSum, healthSum float64
	critical := make([]string, 0)
	for _, p := range projects {
		risks += p.OpenRisks
		slaSum += p.SLAPassRate
		healthSum += p.HealthScore
		if p.HealthScore < 60 || p.OpenRisks >= 3 {
			critical = append(critical, p.Name)
		}
	}
	avgSLA, avgHealth := 0.0, 0.0
	if total > 0 {
		avgSLA = slaSum / float64(total)
		avgHealth = healthSum / float64(total)
	}
	return map[string]interface{}{
		"projectCount": total,
		"openRisks":    risks,
		"avgSlaPass":   math.Round(avgSLA*10) / 10,
		"avgHealth":    math.Round(avgHealth*10) / 10,
		"critical":     critical,
	}
}

// ── 22 Test asset versioning ────────────────────────────────────────────────

type AssetVersion struct {
	AssetID   string    `json:"assetId"`
	Version   int       `json:"version"`
	Author    string    `json:"author"`
	Message   string    `json:"message"`
	Checksum  string    `json:"checksum"`
	CreatedAt time.Time `json:"createdAt"`
}

type AssetVersionStore struct {
	mu   sync.RWMutex
	hist map[string][]AssetVersion
}

func NewAssetVersionStore() *AssetVersionStore {
	return &AssetVersionStore{hist: make(map[string][]AssetVersion)}
}

func (s *AssetVersionStore) Commit(assetID, author, message, content string) AssetVersion {
	s.mu.Lock()
	defer s.mu.Unlock()
	ver := len(s.hist[assetID]) + 1
	v := AssetVersion{
		AssetID: assetID, Version: ver, Author: author, Message: message,
		Checksum: shortHash(content), CreatedAt: time.Now().UTC(),
	}
	s.hist[assetID] = append(s.hist[assetID], v)
	return v
}

func (s *AssetVersionStore) History(assetID string) []AssetVersion {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := append([]AssetVersion{}, s.hist[assetID]...)
	return out
}

func shortHash(s string) string {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return fmt.Sprintf("%08x", h)
}

// ── 23 Script library branching ─────────────────────────────────────────────

type ScriptBranch struct {
	Name       string `json:"name"`
	BaseBranch string `json:"baseBranch"`
	HeadSHA    string `json:"headSha"`
	Protected  bool   `json:"protected"`
}

func MergeBranchAllowed(target, source ScriptBranch, force bool) (bool, string) {
	if target.Protected && !force {
		return false, "target branch is protected"
	}
	if source.HeadSHA == "" {
		return false, "source has no commits"
	}
	if target.HeadSHA == source.HeadSHA {
		return false, "already up to date"
	}
	return true, "ok"
}

// ── 24 Parameterization wizard ──────────────────────────────────────────────

type ParamSuggestion struct {
	Name     string `json:"name"`
	Source   string `json:"source"` // path|query|header|body|cookie
	Example  string `json:"example"`
	Required bool   `json:"required"`
}

func SuggestParameters(urlPath, sampleBody string) []ParamSuggestion {
	out := []ParamSuggestion{}
	// path params {id}
	for i := 0; i < len(urlPath); {
		start := strings.Index(urlPath[i:], "{")
		if start < 0 {
			break
		}
		start += i
		end := strings.Index(urlPath[start:], "}")
		if end < 0 {
			break
		}
		end += start
		name := urlPath[start+1 : end]
		out = append(out, ParamSuggestion{Name: name, Source: "path", Example: "1", Required: true})
		i = end + 1
	}
	if strings.Contains(sampleBody, "email") {
		out = append(out, ParamSuggestion{Name: "email", Source: "body", Example: "user@example.com", Required: true})
	}
	if strings.Contains(sampleBody, "password") {
		out = append(out, ParamSuggestion{Name: "password", Source: "body", Example: "{{vault:secret/login}}", Required: true})
	}
	if len(out) == 0 {
		out = append(out, ParamSuggestion{Name: "page", Source: "query", Example: "1", Required: false})
	}
	return out
}

// ── 25 Correlation studio ───────────────────────────────────────────────────

type CorrelationRule struct {
	Name       string `json:"name"`
	ExtractFrom string `json:"extractFrom"` // body|header
	Pattern    string `json:"pattern"`
	Variable   string `json:"variable"`
}

func DetectCorrelations(responseBody string) []CorrelationRule {
	rules := []CorrelationRule{}
	if strings.Contains(responseBody, "csrf") || strings.Contains(responseBody, "CSRF") {
		rules = append(rules, CorrelationRule{Name: "csrf", ExtractFrom: "body", Pattern: `csrf["']?\s*[:=]\s*["']([^"']+)`, Variable: "csrf_token"})
	}
	if strings.Contains(responseBody, "session") || strings.Contains(responseBody, "JSESSIONID") {
		rules = append(rules, CorrelationRule{Name: "session", ExtractFrom: "header", Pattern: `JSESSIONID=([^;]+)`, Variable: "session_id"})
	}
	if strings.Contains(responseBody, "access_token") || strings.Contains(responseBody, "accessToken") {
		rules = append(rules, CorrelationRule{Name: "oauth", ExtractFrom: "body", Pattern: `"access_token"\s*:\s*"([^"]+)"`, Variable: "access_token"})
	}
	if len(rules) == 0 {
		rules = append(rules, CorrelationRule{Name: "generic-id", ExtractFrom: "body", Pattern: `"id"\s*:\s*"?(\w+)"?`, Variable: "entity_id"})
	}
	return rules
}

// ── 26–27 Network virtualization / WAN emulation ────────────────────────────

type NetworkProfile struct {
	Name         string  `json:"name"`
	LatencyMs    float64 `json:"latencyMs"`
	JitterMs     float64 `json:"jitterMs"`
	LossPct      float64 `json:"lossPct"`
	BandwidthKbps float64 `json:"bandwidthKbps"`
}

func WANProfiles() []NetworkProfile {
	return []NetworkProfile{
		{Name: "LAN", LatencyMs: 2, JitterMs: 0.5, LossPct: 0, BandwidthKbps: 1_000_000},
		{Name: "Metro", LatencyMs: 15, JitterMs: 3, LossPct: 0.05, BandwidthKbps: 100_000},
		{Name: "WAN-EU-US", LatencyMs: 90, JitterMs: 10, LossPct: 0.2, BandwidthKbps: 50_000},
		{Name: "Satellite", LatencyMs: 600, JitterMs: 50, LossPct: 1.0, BandwidthKbps: 5_000},
		{Name: "Congested-3G", LatencyMs: 200, JitterMs: 40, LossPct: 2.0, BandwidthKbps: 1_500},
	}
}

func ApplyWAN(baseP95 float64, p NetworkProfile) float64 {
	// RTT contribution + bandwidth queueing + loss retransmit factor
	retransmit := 1 + p.LossPct/100*2
	return (baseP95 + p.LatencyMs*2 + p.JitterMs) * retransmit
}

// ── 28 Think-time profile library ───────────────────────────────────────────

type ThinkTimeProfile struct {
	Name     string  `json:"name"`
	MinMs    int     `json:"minMs"`
	MaxMs    int     `json:"maxMs"`
	Distribution string `json:"distribution"` // uniform|normal
}

func ThinkTimeLibrary() []ThinkTimeProfile {
	return []ThinkTimeProfile{
		{Name: "none", MinMs: 0, MaxMs: 0, Distribution: "uniform"},
		{Name: "browse", MinMs: 2000, MaxMs: 8000, Distribution: "uniform"},
		{Name: "form-fill", MinMs: 5000, MaxMs: 20000, Distribution: "normal"},
		{Name: "read-heavy", MinMs: 10000, MaxMs: 45000, Distribution: "normal"},
	}
}

// ── 29 Load generator auto-heal ─────────────────────────────────────────────

type LGHealth struct {
	GeneratorID string  `json:"generatorId"`
	CPUPct      float64 `json:"cpuPct"`
	MemPct      float64 `json:"memPct"`
	ErrorRate   float64 `json:"errorRate"`
	Unreachable bool    `json:"unreachable"`
}

func AutoHealAction(h LGHealth) map[string]interface{} {
	actions := []string{}
	severity := "ok"
	if h.Unreachable {
		actions = append(actions, "replace-generator", "reschedule-vus")
		severity = "critical"
	}
	if h.CPUPct > 90 || h.MemPct > 90 {
		actions = append(actions, "drain-and-scale-out")
		severity = "high"
	}
	if h.ErrorRate > 5 {
		actions = append(actions, "restart-engine-process")
		if severity == "ok" {
			severity = "medium"
		}
	}
	if len(actions) == 0 {
		actions = append(actions, "none")
	}
	return map[string]interface{}{"generatorId": h.GeneratorID, "severity": severity, "actions": actions}
}

// ── 30 Distributed result aggregation ───────────────────────────────────────

type ShardResult struct {
	ShardID     string  `json:"shardId"`
	Samples     int     `json:"samples"`
	Throughput  float64 `json:"throughput"`
	AvgLatency  float64 `json:"avgLatency"`
	ErrorCount  int     `json:"errorCount"`
}

func AggregateShards(shards []ShardResult) map[string]interface{} {
	var samples, errors int
	var tp, latWeighted float64
	for _, s := range shards {
		samples += s.Samples
		errors += s.ErrorCount
		tp += s.Throughput
		latWeighted += s.AvgLatency * float64(s.Samples)
	}
	avgLat := 0.0
	if samples > 0 {
		avgLat = latWeighted / float64(samples)
	}
	errRate := 0.0
	if samples > 0 {
		errRate = float64(errors) / float64(samples) * 100
	}
	return map[string]interface{}{
		"shards":       len(shards),
		"samples":      samples,
		"throughput":   tp,
		"avgLatency":   math.Round(avgLat*100) / 100,
		"errorRate":    math.Round(errRate*100) / 100,
		"errorCount":   errors,
	}
}

// ── 31 Multi-run comparison matrix ──────────────────────────────────────────

type RunMatrixRow struct {
	RunID    string  `json:"runId"`
	Label    string  `json:"label"`
	P95      float64 `json:"p95"`
	ErrorRate float64 `json:"errorRate"`
	Throughput float64 `json:"throughput"`
}

func ComparisonMatrix(rows []RunMatrixRow) map[string]interface{} {
	if len(rows) == 0 {
		return map[string]interface{}{"rows": rows, "bestP95": "", "bestThroughput": ""}
	}
	bestP95, bestTP := rows[0].RunID, rows[0].RunID
	minP95, maxTP := rows[0].P95, rows[0].Throughput
	for _, r := range rows[1:] {
		if r.P95 < minP95 {
			minP95, bestP95 = r.P95, r.RunID
		}
		if r.Throughput > maxTP {
			maxTP, bestTP = r.Throughput, r.RunID
		}
	}
	return map[string]interface{}{
		"rows": rows, "bestP95": bestP95, "bestThroughput": bestTP,
		"count": len(rows),
	}
}

// ── 32 Executive board pack ─────────────────────────────────────────────────

func ExecutiveBoardPack(title string, score float64, risks []string, costUSD float64) map[string]interface{} {
	status := "GREEN"
	if score < 80 || len(risks) > 0 {
		status = "AMBER"
	}
	if score < 60 || len(risks) >= 3 {
		status = "RED"
	}
	return map[string]interface{}{
		"title":      title,
		"status":     status,
		"score":      score,
		"risks":      risks,
		"costUsd":    costUSD,
		"summary":    fmt.Sprintf("Performance posture %s (score %.0f). %d open risk(s). Est. cost $%.2f.", status, score, len(risks), costUSD),
		"generatedAt": time.Now().UTC(),
	}
}

// ── 33–34 SLA breach → incident + on-call escalation ────────────────────────

type EscalationLevel struct {
	Level    int      `json:"level"`
	Channels []string `json:"channels"` // slack|pagerduty|email
	AfterMin int      `json:"afterMin"`
}

func EscalationPlan(severity string) []EscalationLevel {
	switch strings.ToLower(severity) {
	case "critical":
		return []EscalationLevel{
			{Level: 1, Channels: []string{"slack", "pagerduty"}, AfterMin: 0},
			{Level: 2, Channels: []string{"pagerduty", "email"}, AfterMin: 15},
		}
	case "high":
		return []EscalationLevel{
			{Level: 1, Channels: []string{"slack"}, AfterMin: 0},
			{Level: 2, Channels: []string{"email"}, AfterMin: 30},
		}
	default:
		return []EscalationLevel{{Level: 1, Channels: []string{"slack"}, AfterMin: 0}}
	}
}

func DraftIncidentFromSLA(service, runID string, errorRate, p95 float64) map[string]interface{} {
	sev := "medium"
	if errorRate > 5 || p95 > 2000 {
		sev = "critical"
	} else if errorRate > 2 || p95 > 1000 {
		sev = "high"
	}
	return map[string]interface{}{
		"title":       fmt.Sprintf("SLA breach: %s (run %s)", service, runID),
		"severity":    sev,
		"errorRate":   errorRate,
		"p95":         p95,
		"escalation":  EscalationPlan(sev),
		"runId":       runID,
		"service":     service,
	}
}

// ── 35 Resource quota soft/hard ─────────────────────────────────────────────

type ResourceQuota struct {
	MaxVUs       int `json:"maxVUs"`
	MaxConcurrent int `json:"maxConcurrent"`
	MaxDailyRuns int `json:"maxDailyRuns"`
}

func CheckQuota(q ResourceQuota, vus, concurrent, dailyRuns int) map[string]interface{} {
	soft, hard := []string{}, []string{}
	if q.MaxVUs > 0 && vus > int(float64(q.MaxVUs)*0.8) && vus <= q.MaxVUs {
		soft = append(soft, "approaching VU quota")
	}
	if q.MaxVUs > 0 && vus > q.MaxVUs {
		hard = append(hard, fmt.Sprintf("VUs %d > max %d", vus, q.MaxVUs))
	}
	if q.MaxConcurrent > 0 && concurrent > q.MaxConcurrent {
		hard = append(hard, "concurrent runs exceeded")
	}
	if q.MaxDailyRuns > 0 && dailyRuns >= q.MaxDailyRuns {
		hard = append(hard, "daily run limit reached")
	}
	return map[string]interface{}{
		"allowed": len(hard) == 0,
		"soft":    soft,
		"hard":    hard,
	}
}

// ── 36 Blue-green test environment switch ───────────────────────────────────

type EnvSlot struct {
	Name    string `json:"name"` // blue|green
	Version string `json:"version"`
	Healthy bool   `json:"healthy"`
	Weight  int    `json:"weight"` // traffic %
}

func BlueGreenSwitch(active, candidate EnvSlot, force bool) map[string]interface{} {
	if !candidate.Healthy && !force {
		return map[string]interface{}{"ok": false, "reason": "candidate unhealthy", "active": active.Name}
	}
	return map[string]interface{}{
		"ok": true,
		"previous": active.Name,
		"active": candidate.Name,
		"version": candidate.Version,
		"weights": map[string]int{candidate.Name: 100, active.Name: 0},
	}
}

// ── 37 Data residency hard gate ─────────────────────────────────────────────

func ResidencyGate(allowedRegions []string, requestedRegion string, dataClass string) map[string]interface{} {
	ok := false
	for _, r := range allowedRegions {
		if strings.EqualFold(r, requestedRegion) || r == "*" {
			ok = true
			break
		}
	}
	// PII/PCI cannot use *
	if (strings.EqualFold(dataClass, "pii") || strings.EqualFold(dataClass, "pci")) && containsStar(allowedRegions) {
		ok = false
		for _, r := range allowedRegions {
			if strings.EqualFold(r, requestedRegion) {
				ok = true
				break
			}
		}
	}
	reason := ""
	if !ok {
		reason = fmt.Sprintf("region %s not allowed for class %s", requestedRegion, dataClass)
	}
	return map[string]interface{}{"allowed": ok, "region": requestedRegion, "dataClass": dataClass, "reason": reason}
}

func containsStar(ss []string) bool {
	for _, s := range ss {
		if s == "*" {
			return true
		}
	}
	return false
}

// ── 38 Continuous testing calendar ──────────────────────────────────────────

type CalendarEvent struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	SuiteID   string    `json:"suiteId"`
	StartsAt  time.Time `json:"startsAt"`
	DurationM int       `json:"durationMin"`
	Env       string    `json:"env"`
}

func CalendarConflicts(events []CalendarEvent) []map[string]string {
	// sort by start
	sorted := append([]CalendarEvent{}, events...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].StartsAt.Before(sorted[j].StartsAt) })
	conflicts := []map[string]string{}
	for i := 0; i < len(sorted); i++ {
		endI := sorted[i].StartsAt.Add(time.Duration(sorted[i].DurationM) * time.Minute)
		for j := i + 1; j < len(sorted); j++ {
			if !sorted[j].StartsAt.Before(endI) {
				break
			}
			if sorted[i].Env == sorted[j].Env {
				conflicts = append(conflicts, map[string]string{
					"a": sorted[i].ID, "b": sorted[j].ID, "env": sorted[i].Env,
				})
			}
		}
	}
	return conflicts
}

// ── 39 Flaky run detector ───────────────────────────────────────────────────

func DetectFlaky(passFail []bool) map[string]interface{} {
	if len(passFail) < 3 {
		return map[string]interface{}{"flaky": false, "reason": "insufficient history", "flipRate": 0.0}
	}
	flips := 0
	for i := 1; i < len(passFail); i++ {
		if passFail[i] != passFail[i-1] {
			flips++
		}
	}
	rate := float64(flips) / float64(len(passFail)-1)
	return map[string]interface{}{
		"flaky":    rate >= 0.3,
		"flipRate": math.Round(rate*100) / 100,
		"flips":    flips,
		"samples":  len(passFail),
	}
}

// ── 40 Performance regression ML-ish baseline ───────────────────────────────

func RegressionAgainstBaseline(baseline []float64, current float64, zThresh float64) map[string]interface{} {
	if zThresh <= 0 {
		zThresh = 2.5
	}
	if len(baseline) < 2 {
		return map[string]interface{}{"regression": false, "reason": "need more baseline points"}
	}
	var sum float64
	for _, v := range baseline {
		sum += v
	}
	mean := sum / float64(len(baseline))
	var variance float64
	for _, v := range baseline {
		d := v - mean
		variance += d * d
	}
	std := math.Sqrt(variance / float64(len(baseline)))
	if std < 1e-6 {
		std = 1
	}
	z := (current - mean) / std
	return map[string]interface{}{
		"regression": z > zThresh,
		"zScore":     math.Round(z*100) / 100,
		"mean":       math.Round(mean*100) / 100,
		"std":        math.Round(std*100) / 100,
		"current":    current,
		"threshold":  zThresh,
	}
}

// ── 41 Platform self-health score ───────────────────────────────────────────

// PlatformComponent is used by phase 41 self-health (distinct from phase7 health matrix).
type PlatformComponent struct {
	Name    string  `json:"name"`
	OK      bool    `json:"ok"`
	Latency float64 `json:"latencyMs"`
}

func PlatformSelfHealth(components []PlatformComponent) map[string]interface{} {
	if len(components) == 0 {
		return map[string]interface{}{"score": 0, "status": "unknown", "components": components}
	}
	okN := 0
	var latSum float64
	for _, c := range components {
		if c.OK {
			okN++
		}
		latSum += c.Latency
	}
	avail := float64(okN) / float64(len(components)) * 100
	avgLat := latSum / float64(len(components))
	// penalize latency > 100ms
	latScore := math.Max(0, 100-avgLat/2)
	score := avail*0.7 + latScore*0.3
	status := "healthy"
	if score < 90 {
		status = "degraded"
	}
	if score < 60 {
		status = "critical"
	}
	return map[string]interface{}{
		"score":      math.Round(score*10) / 10,
		"status":     status,
		"availability": math.Round(avail*10) / 10,
		"avgLatencyMs": math.Round(avgLat*10) / 10,
		"components": components,
	}
}

// Phase21to41Catalog returns features 21–41.
func Phase21to41Catalog() []map[string]string {
	names := []string{
		"Multi-project portfolio dashboard",
		"Test asset versioning",
		"Script library branching",
		"Parameterization wizard",
		"Correlation studio",
		"Network virtualization profiles",
		"WAN emulation profiles",
		"Think-time profile library",
		"Load generator auto-heal",
		"Distributed result aggregation",
		"Multi-run comparison matrix",
		"Executive board pack",
		"SLA breach incident draft",
		"On-call escalation matrix",
		"Resource quota soft/hard limits",
		"Blue-green test env switch",
		"Data residency hard gate",
		"Continuous testing calendar",
		"Flaky run detector",
		"Regression baseline z-score",
		"Platform self-health score",
	}
	items := make([]map[string]string, 0, 21)
	for i, n := range names {
		items = append(items, map[string]string{
			"id":   fmt.Sprintf("%d", i+21),
			"name": n,
			"wave": "21-41",
		})
	}
	return items
}
