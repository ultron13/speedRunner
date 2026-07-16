package impact

import (
	"fmt"
	"sort"
)

// Signal is a correlated evidence signal from infrastructure or APM.
type Signal struct {
	Source      string  `json:"source"` // application | database | cache | kubernetes | redis | network | loadgen
	Component   string  `json:"component"`
	Metric      string  `json:"metric"`
	Value       float64 `json:"value"`
	Threshold   float64 `json:"threshold,omitempty"`
	Saturated   bool    `json:"saturated"`
	Timestamp   int64   `json:"timestamp"`
	Description string  `json:"description,omitempty"`
}

// Bottleneck is a ranked correlation finding for a run.
type Bottleneck struct {
	Source     string   `json:"source"`
	Component  string   `json:"component"`
	Score      float64  `json:"score"` // 0–1 likelihood
	Summary    string   `json:"summary"`
	Evidence   []string `json:"evidence"`
	RunID      string   `json:"runId"`
}

// Correlator ranks infrastructure signals against run symptoms.
type Correlator struct{}

func NewCorrelator() *Correlator {
	return &Correlator{}
}

// Correlate builds bottleneck hypotheses from concurrent signals during a run.
func (c *Correlator) Correlate(runID string, signals []Signal, errorRate, avgRT float64) []Bottleneck {
	// Group by source+component
	type key struct{ source, component string }
	groups := map[key][]Signal{}
	for _, s := range signals {
		k := key{s.Source, s.Component}
		groups[k] = append(groups[k], s)
	}

	var out []Bottleneck
	for k, sigs := range groups {
		score := 0.0
		evidence := make([]string, 0)
		satCount := 0
		for _, s := range sigs {
			if s.Saturated {
				satCount++
				score += 0.25
				evidence = append(evidence, fmt.Sprintf("%s.%s=%.2f (saturated)", s.Component, s.Metric, s.Value))
			} else if s.Threshold > 0 && s.Value > s.Threshold {
				score += 0.15
				evidence = append(evidence, fmt.Sprintf("%s.%s=%.2f exceeds threshold %.2f", s.Component, s.Metric, s.Value, s.Threshold))
			}
		}
		// Weight by application symptoms
		if errorRate > 5 {
			score += 0.1
		}
		if avgRT > 500 {
			score += 0.1
		}
		if score > 1 {
			score = 1
		}
		if score < 0.2 && satCount == 0 {
			continue
		}
		summary := fmt.Sprintf("Possible bottleneck in %s/%s during run", k.source, k.component)
		if satCount > 0 {
			summary = fmt.Sprintf("%s/%s shows saturation (%d signals)", k.source, k.component, satCount)
		}
		out = append(out, Bottleneck{
			Source:    k.source,
			Component: k.component,
			Score:     score,
			Summary:   summary,
			Evidence:  evidence,
			RunID:     runID,
		})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out
}
