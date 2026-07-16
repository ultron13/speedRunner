package results

import (
	"encoding/xml"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// JTLResult represents a single JMeter JTL result entry
type JTLResult struct {
	XMLName        xml.Name `xml:"sample"`
	Timestamp      string   `xml:"ts,attr"`
	Elapsed        string   `xml:"t,attr"`
	Label          string   `xml:"lb,attr"`
	ResponseCode   string   `xml:"rc,attr"`
	ResponseMessage string  `xml:"rm,attr"`
	ThreadName     string   `xml:"tn,attr"`
	DataType       string   `xml:"dt,attr"`
	Success        string   `xml:"s,attr"`
	FailureMessage string   `xml:"fa,attr"`
	Bytes          string   `xml:"by,attr"`
	SentBytes      string   `xml:"sc,attr"`
	GrpThreads     string   `xml:"grpthreads,attr"`
	AllThreads     string   `xml:"allthreads,attr"`
	URL            string   `xml:"href,attr"`
	IdleTime       string   `xml:"lt,attr"`
	Connect        string   `xml:"ct,attr"`
}

type JTLData struct {
	Results []JTLResult `xml:"sample"`
}

type ParsedResults struct {
	RunID          string            `json:"run_id"`
	TotalRequests  int               `json:"total_requests"`
	Successful     int               `json:"successful_requests"`
	Failed         int               `json:"failed_requests"`
	ErrorRate      float64           `json:"error_rate"`
	AvgResponseTime float64          `json:"avg_response_time"`
	MinResponseTime float64          `json:"min_response_time"`
	MaxResponseTime float64          `json:"max_response_time"`
	P50            float64           `json:"p50"`
	P90            float64           `json:"p90"`
	P95            float64           `json:"p95"`
	P99            float64           `json:"p99"`
	Throughput     float64           `json:"throughput"`
	AvgBytes       float64           `json:"avg_bytes"`
	AvgConnectTime float64           `json:"avg_connect_time"`
	Duration       float64           `json:"duration_seconds"`
	Transactions   []TransactionStats `json:"transactions"`
}

type TransactionStats struct {
	Name           string  `json:"name"`
	Count          int     `json:"count"`
	AvgResponseTime float64 `json:"avg_response_time"`
	MinResponseTime float64 `json:"min_response_time"`
	MaxResponseTime float64 `json:"max_response_time"`
	ErrorRate      float64 `json:"error_rate"`
	Throughput     float64 `json:"throughput"`
}

func ParseJTLFile(filepath string, runID string) (*ParsedResults, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read JTL file: %w", err)
	}

	var jtlData JTLData
	if err := xml.Unmarshal(data, &jtlData); err != nil {
		return nil, fmt.Errorf("failed to parse JTL XML: %w", err)
	}

	return parseResults(jtlData.Results, runID), nil
}

func parseResults(results []JTLResult, runID string) *ParsedResults {
	if len(results) == 0 {
		return &ParsedResults{RunID: runID}
	}

	var durations []float64
	var totalDuration float64
	var totalBytes float64
	var totalConnect int
	successful := 0
	failed := 0
	txMap := make(map[string]*TransactionStats)

	var firstTimestamp, lastTimestamp int64

	for _, r := range results {
		elapsed, _ := strconv.ParseFloat(r.Elapsed, 64)
		ts, _ := strconv.ParseInt(r.Timestamp, 10, 64)
		bytes, _ := strconv.ParseFloat(r.Bytes, 64)
		connect, _ := strconv.Atoi(r.Connect)

		durations = append(durations, elapsed)
		totalDuration += elapsed
		totalBytes += bytes
		totalConnect += connect

		if firstTimestamp == 0 || ts < firstTimestamp {
			firstTimestamp = ts
		}
		if ts > lastTimestamp {
			lastTimestamp = ts
		}

		if strings.ToLower(r.Success) == "true" {
			successful++
		} else {
			failed++
		}

		tx, ok := txMap[r.Label]
		if !ok {
			tx = &TransactionStats{Name: r.Label}
			txMap[r.Label] = tx
		}
		tx.Count++
		if strings.ToLower(r.Success) != "true" {
			tx.ErrorRate++
		}
	}

	sort.Float64s(durations)
	total := len(results)

	p50Idx := int(float64(total) * 0.50)
	p90Idx := int(float64(total) * 0.90)
	p95Idx := int(float64(total) * 0.95)
	p99Idx := int(float64(total) * 0.99)

	if p50Idx >= total { p50Idx = total - 1 }
	if p90Idx >= total { p90Idx = total - 1 }
	if p95Idx >= total { p95Idx = total - 1 }
	if p99Idx >= total { p99Idx = total - 1 }

	durationSeconds := float64(lastTimestamp-firstTimestamp) / 1000.0
	if durationSeconds <= 0 {
		durationSeconds = 1
	}

	throughput := float64(total) / durationSeconds

	parsed := &ParsedResults{
		RunID:           runID,
		TotalRequests:   total,
		Successful:      successful,
		Failed:          failed,
		ErrorRate:       float64(failed) / float64(total) * 100,
		AvgResponseTime: totalDuration / float64(total),
		MinResponseTime: durations[0],
		MaxResponseTime: durations[total-1],
		P50:             durations[p50Idx],
		P90:             durations[p90Idx],
		P95:             durations[p95Idx],
		P99:             durations[p99Idx],
		Throughput:      throughput,
		AvgBytes:        totalBytes / float64(total),
		AvgConnectTime:  float64(totalConnect) / float64(total),
		Duration:        durationSeconds,
	}

	for _, tx := range txMap {
		tx.ErrorRate = tx.ErrorRate / float64(tx.Count) * 100
		tx.Throughput = float64(tx.Count) / durationSeconds
		parsed.Transactions = append(parsed.Transactions, *tx)
	}

	return parsed
}
