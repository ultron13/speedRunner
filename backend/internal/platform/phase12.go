package platform

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"
)

// Phase 12 — CI quality gates, digital twin, advanced chaos, browser journeys (12.1–12.50).

// ── 12.1–12.12 CI/CD performance quality gates ──────────────────────────────

type QualityGateRule struct {
	Metric    string  `json:"metric"` // p95|errorRate|throughput|slaPass
	Operator  string  `json:"operator"` // lt|lte|gt|gte|eq
	Threshold float64 `json:"threshold"`
	Required  bool    `json:"required"`
}

type QualityGateResult struct {
	Passed   bool                     `json:"passed"`
	Failures []string                 `json:"failures"`
	Details  []map[string]interface{} `json:"details"`
}

func EvaluateQualityGate(rules []QualityGateRule, metrics map[string]float64) QualityGateResult {
	res := QualityGateResult{Passed: true, Failures: []string{}, Details: []map[string]interface{}{}}
	for _, r := range rules {
		val, ok := metrics[r.Metric]
		if !ok {
			if r.Required {
				res.Passed = false
				res.Failures = append(res.Failures, fmt.Sprintf("missing metric %s", r.Metric))
			}
			continue
		}
		okCmp := compare(val, r.Operator, r.Threshold)
		res.Details = append(res.Details, map[string]interface{}{
			"metric": r.Metric, "value": val, "operator": r.Operator, "threshold": r.Threshold, "pass": okCmp,
		})
		if !okCmp && r.Required {
			res.Passed = false
			res.Failures = append(res.Failures, fmt.Sprintf("%s %s %g failed (got %g)", r.Metric, r.Operator, r.Threshold, val))
		}
	}
	return res
}

func compare(val float64, op string, thr float64) bool {
	switch strings.ToLower(op) {
	case "lt":
		return val < thr
	case "lte":
		return val <= thr
	case "gt":
		return val > thr
	case "gte":
		return val >= thr
	case "eq":
		return math.Abs(val-thr) < 1e-9
	default:
		return false
	}
}

func DefaultReleaseGate() []QualityGateRule {
	return []QualityGateRule{
		{Metric: "errorRate", Operator: "lte", Threshold: 1.0, Required: true},
		{Metric: "p95", Operator: "lte", Threshold: 500, Required: true},
		{Metric: "throughput", Operator: "gte", Threshold: 10, Required: false},
		{Metric: "slaPass", Operator: "eq", Threshold: 1, Required: true},
	}
}

// ── 12.13–12.22 Digital twin / what-if capacity ─────────────────────────────

type DigitalTwinInput struct {
	BaselineVUs     int     `json:"baselineVUs"`
	BaselineRPS     float64 `json:"baselineRPS"`
	BaselineP95     float64 `json:"baselineP95"`
	TargetVUs       int     `json:"targetVUs"`
	SaturationVUs   int     `json:"saturationVUs"` // beyond this, latency grows super-linear
	GrowthExponent  float64 `json:"growthExponent"`
}

type DigitalTwinResult struct {
	ProjectedRPS float64 `json:"projectedRPS"`
	ProjectedP95 float64 `json:"projectedP95"`
	Risk         string  `json:"risk"` // low|medium|high
	Advice       string  `json:"advice"`
}

func SimulateDigitalTwin(in DigitalTwinInput) DigitalTwinResult {
	if in.BaselineVUs <= 0 {
		in.BaselineVUs = 100
	}
	if in.GrowthExponent <= 0 {
		in.GrowthExponent = 1.4
	}
	if in.SaturationVUs <= 0 {
		in.SaturationVUs = in.BaselineVUs * 3
	}
	ratio := float64(in.TargetVUs) / float64(in.BaselineVUs)
	projRPS := in.BaselineRPS * ratio
	// latency grows gently until saturation, then exponent
	latFactor := ratio
	if in.TargetVUs > in.SaturationVUs {
		over := float64(in.TargetVUs) / float64(in.SaturationVUs)
		latFactor = over * math.Pow(over, in.GrowthExponent-1)
	}
	projP95 := in.BaselineP95 * latFactor
	risk := "low"
	advice := "Projected load within healthy capacity envelope"
	if projP95 > in.BaselineP95*2 {
		risk = "medium"
		advice = "Expect significant latency growth — scale horizontally or tune critical path"
	}
	if projP95 > in.BaselineP95*4 || (in.SaturationVUs > 0 && in.TargetVUs > in.SaturationVUs*2) {
		risk = "high"
		advice = "High saturation risk — capacity test recommended before production peak"
	}
	return DigitalTwinResult{ProjectedRPS: projRPS, ProjectedP95: projP95, Risk: risk, Advice: advice}
}

// ── 12.23–12.32 Advanced chaos scenarios ────────────────────────────────────

type ChaosScenario struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Target      string `json:"target"` // pod|network|cpu|latency|dns
	Intensity   int    `json:"intensity"` // 1-10
	DurationSec int    `json:"durationSec"`
	Safe        bool   `json:"safe"` // false = production-blocked
}

func ChaosCatalog() []ChaosScenario {
	return []ChaosScenario{
		{ID: "c-pod-kill", Name: "Random pod kill", Target: "pod", Intensity: 5, DurationSec: 60, Safe: true},
		{ID: "c-net-delay", Name: "Network delay 200ms", Target: "network", Intensity: 4, DurationSec: 120, Safe: true},
		{ID: "c-cpu-stress", Name: "CPU stress 80%", Target: "cpu", Intensity: 7, DurationSec: 90, Safe: true},
		{ID: "c-dns-fail", Name: "DNS intermittent fail", Target: "dns", Intensity: 6, DurationSec: 60, Safe: false},
		{ID: "c-lat-inject", Name: "App latency inject", Target: "latency", Intensity: 5, DurationSec: 180, Safe: true},
	}
}

func ValidateChaos(s ChaosScenario, env string) (bool, string) {
	if s.Intensity < 1 || s.Intensity > 10 {
		return false, "intensity must be 1-10"
	}
	if s.DurationSec <= 0 || s.DurationSec > 3600 {
		return false, "duration out of range"
	}
	if strings.EqualFold(env, "prod") && !s.Safe {
		return false, "scenario blocked in production"
	}
	return true, "ok"
}

type ChaosRun struct {
	ID        string    `json:"id"`
	Scenario  string    `json:"scenarioId"`
	Env       string    `json:"env"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"startedAt"`
}

type ChaosStore struct {
	mu   sync.Mutex
	runs []ChaosRun
}

func NewChaosStore() *ChaosStore {
	return &ChaosStore{runs: make([]ChaosRun, 0)}
}

func (c *ChaosStore) Start(run ChaosRun) ChaosRun {
	c.mu.Lock()
	defer c.mu.Unlock()
	run.Status = "running"
	if run.StartedAt.IsZero() {
		run.StartedAt = time.Now().UTC()
	}
	c.runs = append(c.runs, run)
	return run
}

func (c *ChaosStore) List() []ChaosRun {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]ChaosRun, len(c.runs))
	copy(out, c.runs)
	return out
}

// ── 12.33–12.42 Browser journey advanced ────────────────────────────────────

// JourneyStep / AdvancedBrowserJourney extend phase7's simple BrowserJourney catalog.
type JourneyStep struct {
	Name      string `json:"name"`
	Action    string `json:"action"` // navigate|click|type|wait|assert
	Selector  string `json:"selector,omitempty"`
	Value     string `json:"value,omitempty"`
	Optional  bool   `json:"optional"`
	TimeoutMs int    `json:"timeoutMs"`
}

type AdvancedBrowserJourney struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	BaseURL string        `json:"baseUrl"`
	Steps   []JourneyStep `json:"steps"`
	Engine  string        `json:"engine"` // playwright|truclient
	Tags    []string      `json:"tags"`
}

func ValidateJourney(j AdvancedBrowserJourney) (bool, []string) {
	issues := make([]string, 0)
	if j.Name == "" {
		issues = append(issues, "name required")
	}
	if j.BaseURL == "" {
		issues = append(issues, "baseUrl required")
	}
	if len(j.Steps) == 0 {
		issues = append(issues, "at least one step required")
	}
	for i, s := range j.Steps {
		if s.Action == "" {
			issues = append(issues, fmt.Sprintf("step %d missing action", i))
		}
		if (s.Action == "click" || s.Action == "type" || s.Action == "assert") && s.Selector == "" && !s.Optional {
			issues = append(issues, fmt.Sprintf("step %d missing selector", i))
		}
	}
	return len(issues) == 0, issues
}

func JourneyDurationEstimate(j AdvancedBrowserJourney) int {
	total := 0
	for _, s := range j.Steps {
		if s.TimeoutMs > 0 {
			total += s.TimeoutMs
		} else {
			total += 2000
		}
	}
	return total
}

// ── 12.43–12.49 Performance budget in PR/CI ─────────────────────────────────

type PerfBudget struct {
	Repo       string  `json:"repo"`
	Branch     string  `json:"branch"`
	P95Budget  float64 `json:"p95BudgetMs"`
	ErrorBudget float64 `json:"errorBudgetPct"`
	BundleKB   float64 `json:"bundleBudgetKb,omitempty"`
}

func CheckPerfBudget(b PerfBudget, actualP95, actualError, actualBundle float64) map[string]interface{} {
	pass := true
	fails := []string{}
	if b.P95Budget > 0 && actualP95 > b.P95Budget {
		pass = false
		fails = append(fails, fmt.Sprintf("p95 %.0f > budget %.0f", actualP95, b.P95Budget))
	}
	if b.ErrorBudget > 0 && actualError > b.ErrorBudget {
		pass = false
		fails = append(fails, fmt.Sprintf("errorRate %.2f > budget %.2f", actualError, b.ErrorBudget))
	}
	if b.BundleKB > 0 && actualBundle > b.BundleKB {
		pass = false
		fails = append(fails, fmt.Sprintf("bundle %.0fKB > budget %.0fKB", actualBundle, b.BundleKB))
	}
	return map[string]interface{}{"passed": pass, "failures": fails, "budget": b}
}

// ── 12.50 Catalog ───────────────────────────────────────────────────────────

func Phase12Catalog() []map[string]string {
	names := []string{
		"Quality gate rule model", "Evaluate quality gate", "Missing metric fail", "Operator lt", "Operator lte",
		"Operator gt", "Operator gte", "Operator eq", "Default release gate", "Optional rules",
		"Gate failure list", "Gate details", "Digital twin input", "Twin RPS projection", "Twin p95 projection",
		"Twin low risk", "Twin medium risk", "Twin high risk", "Saturation exponent", "Twin advice text",
		"Chaos catalog", "Chaos intensity bounds", "Chaos duration bounds", "Chaos prod block", "Chaos safe allow",
		"Chaos run start", "Chaos run list", "Chaos network delay", "Chaos pod kill", "Chaos CPU stress",
		"Journey step model", "Journey validate name", "Journey validate URL", "Journey validate steps", "Optional step selector",
		"Journey duration estimate", "Playwright engine tag", "TruClient engine tag", "Perf budget model", "Budget p95 check",
		"Budget error check", "Budget bundle check", "Budget pass", "Budget fail messages", "CI gate integration",
		"What-if capacity", "Browser journey favorites", "Chaos + load combine", "PR performance comment", "Phase 12 catalog",
	}
	items := make([]map[string]string, 0, 50)
	for i, n := range names {
		items = append(items, map[string]string{"id": fmt.Sprintf("12.%d", i+1), "name": n})
	}
	return items
}
