package queries

import "testing"

func TestEvaluateSLA(t *testing.T) {
	cases := []struct {
		cond      string
		threshold float64
		actual    float64
		want      bool
	}{
		{"lt", 100, 90, true},
		{"lt", 100, 100, false},
		{"lte", 100, 100, true},
		{"gt", 50, 60, true},
		{"gte", 50, 50, true},
		{"eq", 1.5, 1.5, true},
		{"", 100, 90, true}, // default lte
	}
	for _, c := range cases {
		got := EvaluateSLA(c.cond, c.threshold, c.actual)
		if got != c.want {
			t.Errorf("EvaluateSLA(%q, %v, %v)=%v want %v", c.cond, c.threshold, c.actual, got, c.want)
		}
	}
}
