package results

type SLAThreshold struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"project_id"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Condition string  `json:"condition"`
	Value     float64 `json:"value"`
	Enabled   bool    `json:"enabled"`
}

type SLAResult struct {
	ID           string  `json:"id"`
	RunID        string  `json:"run_id"`
	ThresholdID  string  `json:"threshold_id"`
	ThresholdName string `json:"threshold_name"`
	ActualValue  float64 `json:"actual_value"`
	ExpectedValue float64 `json:"expected_value"`
	Passed       bool    `json:"passed"`
	Metric       string  `json:"metric"`
}

func EvaluateSLA(thresholds []SLAThreshold, results *ParsedResults, runID string) []SLAResult {

	var slResults []SLAResult

	for _, t := range thresholds {
		if !t.Enabled {
			continue
		}

		var actual float64
		switch t.Metric {
		case "AVG_RESPONSE_TIME":
			actual = results.AvgResponseTime
		case "ERROR_RATE":
			actual = results.ErrorRate
		case "THROUGHPUT":
			actual = results.Throughput
		case "P50":
			actual = results.P50
		case "P90":
			actual = results.P90
		case "P95":
			actual = results.P95
		case "P99":
			actual = results.P99
		default:
			continue
		}

		passed := false
		switch t.Condition {
		case "LESS_THAN":
			passed = actual < t.Value
		case "GREATER_THAN":
			passed = actual > t.Value
		}

		slResults = append(slResults, SLAResult{
			ID:            t.ID,
			RunID:         runID,
			ThresholdID:   t.ID,
			ThresholdName: t.Name,
			ActualValue:   actual,
			ExpectedValue: t.Value,
			Passed:        passed,
			Metric:        t.Metric,
		})
	}

	return slResults
}

