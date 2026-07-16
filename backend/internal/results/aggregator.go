package results

import (
	"sort"
)

// Aggregator calculates aggregate metrics from raw results
type Aggregator struct{}

// NewAggregator creates a new aggregator
func NewAggregator() *Aggregator {
	return &Aggregator{}
}

// AggregateMetrics calculates aggregate metrics from parsed results
func (a *Aggregator) AggregateMetrics(results *ParsedResults) *AggregateMetrics {
	if results == nil || len(results.Transactions) == 0 {
		return &AggregateMetrics{}
	}

	// Calculate transaction-level aggregates
	transactionAggregates := make([]TransactionAggregate, 0, len(results.Transactions))
	for _, tx := range results.Transactions {
		agg := TransactionAggregate{
			Name:           tx.Name,
			Count:          tx.Count,
			ErrorRate:      tx.ErrorRate,
			Throughput:     tx.Throughput,
			AvgResponseTime: tx.AvgResponseTime,
			MinResponseTime: tx.MinResponseTime,
			MaxResponseTime: tx.MaxResponseTime,
		}
		transactionAggregates = append(transactionAggregates, agg)
	}

	// Sort by count descending
	sort.Slice(transactionAggregates, func(i, j int) bool {
		return transactionAggregates[i].Count > transactionAggregates[j].Count
	})

	return &AggregateMetrics{
		TotalRequests:      results.TotalRequests,
		SuccessfulRequests: results.Successful,
		FailedRequests:     results.Failed,
		ErrorRate:          results.ErrorRate,
		AvgResponseTime:    results.AvgResponseTime,
		MinResponseTime:    results.MinResponseTime,
		MaxResponseTime:    results.MaxResponseTime,
		P50:                results.P50,
		P90:                results.P90,
		P95:                results.P95,
		P99:                results.P99,
		Throughput:         results.Throughput,
		AvgBytes:           results.AvgBytes,
		AvgConnectTime:     results.AvgConnectTime,
		Duration:           results.Duration,
		Transactions:       transactionAggregates,
	}
}

// AggregateMetrics contains calculated aggregate metrics
type AggregateMetrics struct {
	TotalRequests      int                    `json:"total_requests"`
	SuccessfulRequests int                    `json:"successful_requests"`
	FailedRequests     int                    `json:"failed_requests"`
	ErrorRate          float64                `json:"error_rate"`
	AvgResponseTime    float64                `json:"avg_response_time"`
	MinResponseTime    float64                `json:"min_response_time"`
	MaxResponseTime    float64                `json:"max_response_time"`
	P50                float64                `json:"p50"`
	P90                float64                `json:"p90"`
	P95                float64                `json:"p95"`
	P99                float64                `json:"p99"`
	Throughput         float64                `json:"throughput"`
	AvgBytes           float64                `json:"avg_bytes"`
	AvgConnectTime     float64                `json:"avg_connect_time"`
	Duration           float64                `json:"duration_seconds"`
	Transactions       []TransactionAggregate `json:"transactions"`
}

// TransactionAggregate contains aggregated metrics for a transaction
type TransactionAggregate struct {
	Name           string  `json:"name"`
	Count          int     `json:"count"`
	ErrorRate      float64 `json:"error_rate"`
	Throughput     float64 `json:"throughput"`
	AvgResponseTime float64 `json:"avg_response_time"`
	MinResponseTime float64 `json:"min_response_time"`
	MaxResponseTime float64 `json:"max_response_time"`
}
