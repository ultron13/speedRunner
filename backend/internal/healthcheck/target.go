package healthcheck

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// TargetHealthChecker checks if the target system is healthy before test execution
type TargetHealthChecker struct {
	client *http.Client
}

func NewTargetHealthChecker() *TargetHealthChecker {
	return &TargetHealthChecker{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// CheckTarget verifies the target endpoint is reachable
func (t *TargetHealthChecker) CheckTarget(ctx context.Context, targetURL string) (*HealthCheckResult, error) {
	result := &HealthCheckResult{
		Target:    targetURL,
		CheckedAt: time.Now(),
	}

	req, err := http.NewRequestWithContext(ctx, "HEAD", targetURL, nil)
	if err != nil {
		result.Status = "error"
		result.Message = fmt.Sprintf("Failed to create request: %v", err)
		return result, nil
	}

	start := time.Now()
	resp, err := t.client.Do(req)
	latency := time.Since(start)

	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Target unreachable: %v", err)
		return result, nil
	}
	defer resp.Body.Close()

	result.Status = "healthy"
	result.StatusCode = resp.StatusCode
	result.Latency = latency

	if resp.StatusCode >= 500 {
		result.Status = "degraded"
		result.Message = fmt.Sprintf("Target returned %d", resp.StatusCode)
	}

	return result, nil
}

// HealthCheckResult contains the result of a health check
type HealthCheckResult struct {
	Target     string        `json:"target"`
	Status     string        `json:"status"`
	StatusCode int           `json:"status_code,omitempty"`
	Latency    time.Duration `json:"latency"`
	Message    string        `json:"message,omitempty"`
	CheckedAt  time.Time     `json:"checked_at"`
}

// ReadinessChecker checks if all platform components are ready
type ReadinessChecker struct {
	checks []CheckFunc
}

type CheckFunc func(ctx context.Context) (*ComponentStatus, error)

type ComponentStatus struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

func NewReadinessChecker() *ReadinessChecker {
	return &ReadinessChecker{
		checks: make([]CheckFunc, 0),
	}
}

func (r *ReadinessChecker) AddCheck(check CheckFunc) {
	r.checks = append(r.checks, check)
}

func (r *ReadinessChecker) CheckAll(ctx context.Context) ([]ComponentStatus, error) {
	var statuses []ComponentStatus
	for _, check := range r.checks {
		status, err := check(ctx)
		if err != nil {
			statuses = append(statuses, ComponentStatus{
				Name:    "unknown",
				Status:  "error",
				Message: err.Error(),
			})
			continue
		}
		statuses = append(statuses, *status)
	}
	return statuses, nil
}
