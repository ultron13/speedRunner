package ai

import (
	"math"
	"sort"
)

// MetricPoint is a single time-series observation.
type MetricPoint struct {
	Timestamp int64
	Value     float64
}

// Finding is an AI-assisted anomaly result with evidence and confidence.
type Finding struct {
	Metric      string  `json:"metric"`
	Severity    string  `json:"severity"` // low | medium | high
	Message     string  `json:"message"`
	Confidence  float64 `json:"confidence"` // 0–1
	Actual      float64 `json:"actual"`
	Baseline    float64 `json:"baseline"`
	ZScore      float64 `json:"zScore"`
	Evidence    string  `json:"evidence"`
}

// Detector performs simple statistical anomaly detection (z-score / IQR).
// This is a deterministic baseline; Phase 7 can swap in ML models.
type Detector struct {
	// ZThreshold is the absolute z-score above which a point is anomalous (default 2.5).
	ZThreshold float64
}

func NewDetector() *Detector {
	return &Detector{ZThreshold: 2.5}
}

// Detect evaluates the latest point against historical series for one metric.
func (d *Detector) Detect(metric string, history []MetricPoint, current float64) *Finding {
	if len(history) < 5 {
		return nil
	}
	values := make([]float64, len(history))
	for i, p := range history {
		values[i] = p.Value
	}
	mean, std := meanStd(values)
	if std < 1e-9 {
		// No variance — only flag if current is far from mean relatively
		if mean > 0 && math.Abs(current-mean)/mean > 0.5 {
			return &Finding{
				Metric:     metric,
				Severity:   "medium",
				Message:    metric + " deviated from flat baseline",
				Confidence: 0.6,
				Actual:     current,
				Baseline:   mean,
				ZScore:     0,
				Evidence:   "baseline had near-zero variance; relative deviation > 50%",
			}
		}
		return nil
	}

	z := (current - mean) / std
	absZ := math.Abs(z)
	thresh := d.ZThreshold
	if thresh <= 0 {
		thresh = 2.5
	}
	if absZ < thresh {
		return nil
	}

	sev := "low"
	conf := math.Min(0.99, absZ/5.0)
	if absZ >= 4 {
		sev = "high"
	} else if absZ >= 3 {
		sev = "medium"
	}

	direction := "spike"
	if z < 0 {
		direction = "drop"
	}

	return &Finding{
		Metric:     metric,
		Severity:   sev,
		Message:    metric + " " + direction + " detected",
		Confidence: conf,
		Actual:     current,
		Baseline:   mean,
		ZScore:     z,
		Evidence:   "z-score against rolling mean/std of recent samples",
	}
}

// DetectSeries scans a full series and returns findings for outlier points.
func (d *Detector) DetectSeries(metric string, series []MetricPoint) []Finding {
	if len(series) < 6 {
		return nil
	}
	findings := make([]Finding, 0)
	for i := 5; i < len(series); i++ {
		hist := series[:i]
		if f := d.Detect(metric, hist, series[i].Value); f != nil {
			findings = append(findings, *f)
		}
	}
	return findings
}

// RecommendLoadProfile suggests VUs and duration from a high-level goal string.
func RecommendLoadProfile(goal string, peakRPS int) map[string]interface{} {
	vus := 50
	duration := 300
	if peakRPS > 0 {
		// Assume ~1 RPS per VU with think time
		vus = peakRPS
		if vus < 10 {
			vus = 10
		}
		if vus > 5000 {
			vus = 5000
		}
	}
	profile := "steady"
	switch {
	case containsAny(goal, "spike", "burst"):
		profile = "spike"
		duration = 180
	case containsAny(goal, "stress", "break"):
		profile = "stress"
		vus = int(float64(vus) * 1.5)
		duration = 600
	case containsAny(goal, "soak", "endurance", "longevity"):
		profile = "soak"
		duration = 3600
	case containsAny(goal, "smoke", "sanity"):
		profile = "smoke"
		vus = 5
		duration = 60
	}
	return map[string]interface{}{
		"profile":        profile,
		"virtualUsers":   vus,
		"durationSec":    duration,
		"rampUpSec":      max(30, duration/10),
		"warning":        "AI recommendation is a draft — review before production execution",
		"confidence":     0.55,
	}
}

func meanStd(values []float64) (mean, std float64) {
	n := float64(len(values))
	if n == 0 {
		return 0, 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean = sum / n
	var variance float64
	for _, v := range values {
		d := v - mean
		variance += d * d
	}
	std = math.Sqrt(variance / n)
	return mean, std
}

// Percentile computes an approximate percentile (0–100) of sorted copy.
func Percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	cp := make([]float64, len(values))
	copy(cp, values)
	sort.Float64s(cp)
	if p <= 0 {
		return cp[0]
	}
	if p >= 100 {
		return cp[len(cp)-1]
	}
	idx := (p / 100) * float64(len(cp)-1)
	lo := int(math.Floor(idx))
	hi := int(math.Ceil(idx))
	if lo == hi {
		return cp[lo]
	}
	frac := idx - float64(lo)
	return cp[lo]*(1-frac) + cp[hi]*frac
}

func containsAny(s string, words ...string) bool {
	ls := toLower(s)
	for _, w := range words {
		if contains(ls, w) {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
