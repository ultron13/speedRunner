package telemetry

import (
	"context"
	"strings"
	"testing"
)

func TestTraceIDs(t *testing.T) {
	tid := NewTraceID()
	if len(tid) != 32 {
		t.Fatalf("trace id len=%d", len(tid))
	}
	sid := NewSpanID()
	if len(sid) != 16 {
		t.Fatalf("span id len=%d", len(sid))
	}
	tp := Traceparent(tid, sid)
	if !strings.HasPrefix(tp, "00-") {
		t.Fatalf("traceparent=%s", tp)
	}
}

func TestContextRoundTrip(t *testing.T) {
	c := ForRun("run1", "test1", "proj1")
	ctx := WithCorrelation(context.Background(), c)
	got := FromContext(ctx)
	if got.RunID != "run1" || got.TraceID == "" {
		t.Fatalf("got %+v", got)
	}
	labels := c.Labels()
	if labels["run_id"] != "run1" {
		t.Fatalf("labels=%v", labels)
	}
}
