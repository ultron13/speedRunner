package telemetry

import (
	"net/http"
)

// Middleware injects W3C traceparent / run correlation headers into the request context.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			// Parse traceparent if present: 00-<trace>-<span>-01
			if tp := r.Header.Get("Traceparent"); tp != "" {
				parts := splitTraceparent(tp)
				if len(parts) >= 2 {
					traceID = parts[1]
				}
			}
		}
		if traceID == "" {
			traceID = NewTraceID()
		}
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = NewSpanID()
		}
		runID := r.Header.Get("X-Run-Id")

		c := Correlation{
			TraceID:   traceID,
			RequestID: reqID,
			RunID:     runID,
		}
		ctx := WithCorrelation(r.Context(), c)

		w.Header().Set("X-Trace-Id", traceID)
		w.Header().Set("X-Request-Id", reqID)
		w.Header().Set("Traceparent", Traceparent(traceID, NewSpanID()))
		if runID != "" {
			w.Header().Set("X-Run-Id", runID)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func splitTraceparent(tp string) []string {
	out := make([]string, 0, 4)
	start := 0
	for i := 0; i <= len(tp); i++ {
		if i == len(tp) || tp[i] == '-' {
			out = append(out, tp[start:i])
			start = i + 1
		}
	}
	return out
}

// PropagateHeaders returns headers to inject into outbound engine/HTTP calls.
func PropagateHeaders(c Correlation) map[string]string {
	h := map[string]string{
		"Traceparent":  Traceparent(c.TraceID, NewSpanID()),
		"X-Trace-Id":   c.TraceID,
		"X-Request-Id": c.RequestID,
	}
	if c.RunID != "" {
		h["X-Run-Id"] = c.RunID
		h["X-SpeedRunner-Run-Id"] = c.RunID
	}
	if c.TestID != "" {
		h["X-Test-Id"] = c.TestID
	}
	return h
}
