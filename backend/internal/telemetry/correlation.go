package telemetry

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

type ctxKey string

const (
	keyRunID     ctxKey = "run_id"
	keyTraceID   ctxKey = "trace_id"
	keyRequestID ctxKey = "request_id"
)

// Correlation carries identifiers propagated across metrics, logs, and traces.
type Correlation struct {
	RunID     string `json:"runId,omitempty"`
	TraceID   string `json:"traceId,omitempty"`
	RequestID string `json:"requestId,omitempty"`
	TestID    string `json:"testId,omitempty"`
	ProjectID string `json:"projectId,omitempty"`
}

// NewTraceID generates a 16-byte hex trace ID compatible with W3C Trace Context.
func NewTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// NewSpanID generates an 8-byte hex span ID.
func NewSpanID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// WithCorrelation stores correlation IDs on the context.
func WithCorrelation(ctx context.Context, c Correlation) context.Context {
	if c.RunID != "" {
		ctx = context.WithValue(ctx, keyRunID, c.RunID)
	}
	if c.TraceID != "" {
		ctx = context.WithValue(ctx, keyTraceID, c.TraceID)
	}
	if c.RequestID != "" {
		ctx = context.WithValue(ctx, keyRequestID, c.RequestID)
	}
	return ctx
}

// FromContext extracts correlation IDs from context.
func FromContext(ctx context.Context) Correlation {
	c := Correlation{}
	if v, ok := ctx.Value(keyRunID).(string); ok {
		c.RunID = v
	}
	if v, ok := ctx.Value(keyTraceID).(string); ok {
		c.TraceID = v
	}
	if v, ok := ctx.Value(keyRequestID).(string); ok {
		c.RequestID = v
	}
	return c
}

// Traceparent builds a W3C traceparent header value.
func Traceparent(traceID, spanID string) string {
	if traceID == "" {
		traceID = NewTraceID()
	}
	if spanID == "" {
		spanID = NewSpanID()
	}
	return fmt.Sprintf("00-%s-%s-01", traceID, spanID)
}

// Labels returns common label map for Prometheus / OpenTelemetry attributes.
func (c Correlation) Labels() map[string]string {
	m := make(map[string]string)
	if c.RunID != "" {
		m["run_id"] = c.RunID
	}
	if c.TraceID != "" {
		m["trace_id"] = c.TraceID
	}
	if c.TestID != "" {
		m["test_id"] = c.TestID
	}
	if c.ProjectID != "" {
		m["project_id"] = c.ProjectID
	}
	if c.RequestID != "" {
		m["request_id"] = c.RequestID
	}
	return m
}

// ForRun creates a correlation bundle for a new test run.
func ForRun(runID, testID, projectID string) Correlation {
	return Correlation{
		RunID:     runID,
		TestID:    testID,
		ProjectID: projectID,
		TraceID:   NewTraceID(),
	}
}
