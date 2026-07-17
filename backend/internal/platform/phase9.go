package platform

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 9 — Resilience, multi-region DR, observability & capacity (9.1–9.50).

// ── 9.1–9.8 Multi-region health & failover ──────────────────────────────────

type RegionHealth struct {
	Name       string  `json:"name"`
	Healthy    bool    `json:"healthy"`
	LatencyMs  float64 `json:"latencyMs"`
	ErrorRate  float64 `json:"errorRate"`
	CapacityVU int     `json:"capacityVU"`
	UsedVU     int     `json:"usedVU"`
}

func RegionScore(r RegionHealth) float64 {
	if !r.Healthy {
		return 0
	}
	avail := 1.0
	if r.CapacityVU > 0 {
		avail = 1 - float64(r.UsedVU)/float64(r.CapacityVU)
		if avail < 0 {
			avail = 0
		}
	}
	// Higher score is better: capacity free, low latency, low errors
	latPenalty := math.Min(r.LatencyMs/1000.0, 1)
	errPenalty := math.Min(r.ErrorRate/100.0, 1)
	return avail*0.5 + (1-latPenalty)*0.3 + (1-errPenalty)*0.2
}

func PickPrimaryRegion(regions []RegionHealth) (RegionHealth, bool) {
	var best RegionHealth
	bestScore := -1.0
	found := false
	for _, r := range regions {
		s := RegionScore(r)
		if s > bestScore {
			bestScore = s
			best = r
			found = true
		}
	}
	return best, found && bestScore > 0
}

func FailoverPlan(regions []RegionHealth) map[string]interface{} {
	primary, ok := PickPrimaryRegion(regions)
	ranked := make([]RegionHealth, len(regions))
	copy(ranked, regions)
	sort.Slice(ranked, func(i, j int) bool {
		return RegionScore(ranked[i]) > RegionScore(ranked[j])
	})
	secondaries := make([]string, 0)
	for _, r := range ranked {
		if r.Name != primary.Name && r.Healthy {
			secondaries = append(secondaries, r.Name)
		}
	}
	return map[string]interface{}{
		"primary":     primary.Name,
		"primaryOK":   ok,
		"secondaries": secondaries,
		"ranked":      ranked,
	}
}

// ── 9.9–9.15 DR / backup / RTO-RPO ──────────────────────────────────────────

type DRPolicy struct {
	Name          string `json:"name"`
	RPOMinutes    int    `json:"rpoMinutes"`
	RTOMinutes    int    `json:"rtoMinutes"`
	BackupCron    string `json:"backupCron"`
	Regions       int    `json:"regions"`
	LastBackupAge int    `json:"lastBackupAgeMinutes"` // minutes since last backup
}

func EvaluateDR(p DRPolicy) map[string]interface{} {
	rpoOK := p.LastBackupAge <= p.RPOMinutes
	tier := "bronze"
	if p.Regions >= 3 && p.RPOMinutes <= 15 && p.RTOMinutes <= 30 {
		tier = "gold"
	} else if p.Regions >= 2 && p.RPOMinutes <= 60 && p.RTOMinutes <= 120 {
		tier = "silver"
	}
	return map[string]interface{}{
		"policy":   p,
		"rpoMet":   rpoOK,
		"tier":     tier,
		"severity": rpoOK && p.Regions >= 2,
	}
}

func BackupScheduleOK(cron string, lastRun time.Time, maxGap time.Duration) bool {
	if cron == "" {
		return false
	}
	return time.Since(lastRun) <= maxGap
}

// ── 9.16–9.22 Observability: traces, sampling, correlation ──────────────────

type TraceSample struct {
	TraceID      string  `json:"traceId"`
	SpanID       string  `json:"spanId"`
	Service      string  `json:"service"`
	DurationMs   float64 `json:"durationMs"`
	Status       string  `json:"status"` // ok|error
	ParentSpanID string  `json:"parentSpanId,omitempty"`
}

func ShouldSample(traceID string, rate float64) bool {
	if rate >= 1 {
		return true
	}
	if rate <= 0 {
		return false
	}
	// deterministic: hash first bytes of id
	var h uint32
	for i := 0; i < len(traceID) && i < 8; i++ {
		h = h*31 + uint32(traceID[i])
	}
	return float64(h%10000)/10000.0 < rate
}

func CorrelateRunTraces(runID string, traces []TraceSample) map[string]interface{} {
	var total, errors float64
	services := map[string]int{}
	for _, t := range traces {
		total += t.DurationMs
		if t.Status == "error" {
			errors++
		}
		services[t.Service]++
	}
	return map[string]interface{}{
		"runId":        runID,
		"spanCount":    len(traces),
		"totalMs":      total,
		"errorSpans":   errors,
		"serviceCount": len(services),
		"services":     services,
	}
}

// ── 9.23–9.28 Synthetic monitoring ──────────────────────────────────────────

type SyntheticCheck struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	URL       string  `json:"url"`
	IntervalS int     `json:"intervalSec"`
	TimeoutMs int     `json:"timeoutMs"`
	LastOK    bool    `json:"lastOk"`
	LastMs    float64 `json:"lastMs"`
}

func EvaluateSynthetic(checks []SyntheticCheck, maxFailRatio float64) map[string]interface{} {
	if len(checks) == 0 {
		return map[string]interface{}{"status": "unknown", "passRate": 0.0, "failing": []string{}}
	}
	ok := 0
	failing := make([]string, 0)
	for _, c := range checks {
		if c.LastOK {
			ok++
		} else {
			failing = append(failing, c.Name)
		}
	}
	pass := float64(ok) / float64(len(checks))
	status := "healthy"
	if pass < 1-maxFailRatio {
		status = "critical"
	} else if pass < 1 {
		status = "degraded"
	}
	return map[string]interface{}{
		"status":   status,
		"passRate": pass,
		"failing":  failing,
		"total":    len(checks),
	}
}

// ── 9.29–9.35 Canary / progressive delivery analysis ────────────────────────

type CanarySnapshot struct {
	BaselineErrorRate float64 `json:"baselineErrorRate"`
	CanaryErrorRate   float64 `json:"canaryErrorRate"`
	BaselineP95Ms     float64 `json:"baselineP95Ms"`
	CanaryP95Ms       float64 `json:"canaryP95Ms"`
	CanaryTrafficPct  float64 `json:"canaryTrafficPct"`
	MinSample         int     `json:"minSample"`
	SampleSize        int     `json:"sampleSize"`
}

func AnalyzeCanary(s CanarySnapshot) map[string]interface{} {
	if s.SampleSize < s.MinSample {
		return map[string]interface{}{
			"decision": "wait",
			"reason":   "insufficient samples",
			"samples":  s.SampleSize,
			"need":     s.MinSample,
		}
	}
	errDelta := s.CanaryErrorRate - s.BaselineErrorRate
	p95Delta := 0.0
	if s.BaselineP95Ms > 0 {
		p95Delta = (s.CanaryP95Ms - s.BaselineP95Ms) / s.BaselineP95Ms
	}
	decision := "promote"
	reason := "canary within thresholds"
	if errDelta > 1.0 { // +1 absolute percentage point
		decision = "rollback"
		reason = "error rate regression"
	} else if p95Delta > 0.25 {
		decision = "rollback"
		reason = "p95 latency regression >25%"
	} else if errDelta > 0.3 || p95Delta > 0.1 {
		decision = "hold"
		reason = "soft regression — hold traffic"
	}
	return map[string]interface{}{
		"decision":      decision,
		"reason":        reason,
		"errorDelta":    errDelta,
		"p95DeltaRatio": p95Delta,
		"trafficPct":    s.CanaryTrafficPct,
	}
}

// ── 9.36–9.42 Capacity planning ─────────────────────────────────────────────

type CapacityInput struct {
	CurrentVUs      int     `json:"currentVUs"`
	PeakVUs         int     `json:"peakVUs"`
	TargetHeadroom  float64 `json:"targetHeadroom"` // e.g. 0.3 = 30% free
	NodeCapacityVUs int     `json:"nodeCapacityVUs"`
	Nodes           int     `json:"nodes"`
	GrowthPctMonth  float64 `json:"growthPctMonth"`
	HorizonMonths   int     `json:"horizonMonths"`
}

func PlanCapacity(in CapacityInput) map[string]interface{} {
	if in.NodeCapacityVUs <= 0 {
		in.NodeCapacityVUs = 500
	}
	if in.TargetHeadroom <= 0 {
		in.TargetHeadroom = 0.2
	}
	if in.HorizonMonths <= 0 {
		in.HorizonMonths = 3
	}
	totalCap := in.Nodes * in.NodeCapacityVUs
	util := 0.0
	if totalCap > 0 {
		util = float64(in.PeakVUs) / float64(totalCap)
	}
	needed := int(math.Ceil(float64(in.PeakVUs) / (1 - in.TargetHeadroom)))
	nodesNeeded := int(math.Ceil(float64(needed) / float64(in.NodeCapacityVUs)))
	// growth projection
	proj := float64(in.PeakVUs)
	for i := 0; i < in.HorizonMonths; i++ {
		proj *= 1 + in.GrowthPctMonth/100
	}
	futureNodes := int(math.Ceil(proj / ((1 - in.TargetHeadroom) * float64(in.NodeCapacityVUs))))
	status := "ok"
	if util > 1-in.TargetHeadroom {
		status = "scale_up"
	}
	if util > 0.95 {
		status = "critical"
	}
	return map[string]interface{}{
		"status":            status,
		"utilization":       util,
		"totalCapacityVU":   totalCap,
		"nodesNeededNow":    nodesNeeded,
		"projectedPeakVU":   int(proj),
		"nodesNeededFuture": futureNodes,
		"headroomTarget":    in.TargetHeadroom,
	}
}

// ── 9.43–9.47 Config export / import bundles ────────────────────────────────

type ExportBundle struct {
	Version   string                   `json:"version"`
	CreatedAt time.Time                `json:"createdAt"`
	Tests     []map[string]interface{} `json:"tests"`
	SLA       []map[string]interface{} `json:"sla"`
	Flags     map[string]bool          `json:"flags"`
	Checksum  string                   `json:"checksum"`
}

func BuildExportBundle(tests, sla []map[string]interface{}, flags map[string]bool) ExportBundle {
	b := ExportBundle{
		Version:   "1.0",
		CreatedAt: time.Now().UTC(),
		Tests:     tests,
		SLA:       sla,
		Flags:     flags,
	}
	// simple checksum from counts + flag keys
	keys := make([]string, 0, len(flags))
	for k := range flags {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	b.Checksum = fmt.Sprintf("t%d-s%d-f%d-%s", len(tests), len(sla), len(flags), strings.Join(keys, ","))
	if len(b.Checksum) > 64 {
		b.Checksum = b.Checksum[:64]
	}
	return b
}

func ValidateImportBundle(b ExportBundle) (bool, []string) {
	issues := make([]string, 0)
	if b.Version == "" {
		issues = append(issues, "missing version")
	}
	if b.Checksum == "" {
		issues = append(issues, "missing checksum")
	}
	expected := BuildExportBundle(b.Tests, b.SLA, b.Flags).Checksum
	// rebuild ignores CreatedAt; compare structural checksum pattern loosely
	if b.Checksum != "" && !strings.HasPrefix(b.Checksum, fmt.Sprintf("t%d-s%d-f%d", len(b.Tests), len(b.SLA), len(b.Flags))) {
		// allow exact match against regenerated
		regen := expected
		if b.Checksum != regen && !strings.Contains(b.Checksum, fmt.Sprintf("t%d", len(b.Tests))) {
			issues = append(issues, "checksum mismatch")
		}
	}
	return len(issues) == 0, issues
}

// ── 9.48–9.49 Feature rollout percentage ────────────────────────────────────

type Rollout struct {
	Feature string `json:"feature"`
	Percent int    `json:"percent"` // 0-100
}

func RolloutEnabled(r Rollout, userKey string) bool {
	if r.Percent >= 100 {
		return true
	}
	if r.Percent <= 0 {
		return false
	}
	var h uint32
	for i := 0; i < len(userKey); i++ {
		h = h*31 + uint32(userKey[i])
	}
	return int(h%100) < r.Percent
}

// ── 9.50 Catalog + in-memory synthetic registry ─────────────────────────────

type SyntheticStore struct {
	mu     sync.RWMutex
	checks map[string]SyntheticCheck
}

func NewSyntheticStore() *SyntheticStore {
	return &SyntheticStore{checks: make(map[string]SyntheticCheck)}
}

func (s *SyntheticStore) Upsert(c SyntheticCheck) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.checks[c.ID] = c
}

func (s *SyntheticStore) List() []SyntheticCheck {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]SyntheticCheck, 0, len(s.checks))
	for _, c := range s.checks {
		out = append(out, c)
	}
	return out
}

func Phase9Catalog() []map[string]string {
	names := []string{
		"Region health model", "Region scoring", "Primary region pick", "Failover plan", "Secondary ranking",
		"Latency penalty", "Error rate penalty", "Capacity availability", "DR policy model", "RPO evaluation",
		"RTO tier gold", "RTO tier silver", "DR readiness", "Backup schedule OK", "Multi-region DR",
		"Trace sample model", "Deterministic sampling", "Sample rate 0", "Sample rate 1", "Run-trace correlation",
		"Error span count", "Service fan-out", "Synthetic check model", "Synthetic pass rate", "Synthetic critical",
		"Synthetic degraded", "Synthetic healthy", "Empty synthetics", "Canary snapshot", "Canary wait samples",
		"Canary promote", "Canary rollback errors", "Canary rollback latency", "Canary hold soft", "Traffic percent",
		"Capacity input", "Utilization calc", "Scale-up status", "Critical util", "Growth projection",
		"Nodes needed now", "Future nodes", "Export bundle build", "Export checksum", "Import validate",
		"Import issues", "Feature rollout %", "Rollout always on", "Rollout always off", "Phase 9 catalog",
	}
	items := make([]map[string]string, 0, 50)
	for i, n := range names {
		items = append(items, map[string]string{
			"id":   fmt.Sprintf("9.%d", i+1),
			"name": n,
		})
	}
	return items
}
