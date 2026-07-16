package api

// SpecVersion is the public API version string.
const SpecVersion = "0.2.0"

// OpenAPIDoc returns a minimal OpenAPI 3.0 document describing the control plane.
// Kept as a map for JSON encoding without external YAML deps.
func OpenAPIDoc() map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "SpeedRunner Control Plane API",
			"version":     SpecVersion,
			"description": "Enterprise performance testing platform control plane",
		},
		"servers": []map[string]string{
			{"url": "/api", "description": "Control plane"},
		},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"bearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
				},
			},
		},
		"security": []map[string][]string{
			{"bearerAuth": {}},
		},
		"paths": map[string]interface{}{
			"/auth/login": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Login",
					"security": []interface{}{},
					"tags":    []string{"Auth"},
				},
			},
			"/auth/register": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Register user",
					"security": []interface{}{},
					"tags":    []string{"Auth"},
				},
			},
			"/auth/me": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "Current user",
					"tags":    []string{"Auth"},
				},
			},
			"/projects": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List projects", "tags": []string{"Projects"}},
				"post": map[string]interface{}{"summary": "Create project", "tags": []string{"Projects"}},
			},
			"/tests": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List tests", "tags": []string{"Tests"}},
				"post": map[string]interface{}{"summary": "Create test", "tags": []string{"Tests"}},
			},
			"/tests/{id}/start": map[string]interface{}{
				"post": map[string]interface{}{"summary": "Start test run", "tags": []string{"Tests"}},
			},
			"/tests/{id}/stop": map[string]interface{}{
				"post": map[string]interface{}{"summary": "Stop test", "tags": []string{"Tests"}},
			},
			"/runs": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List runs", "tags": []string{"Runs"}},
				"post": map[string]interface{}{"summary": "Create run", "tags": []string{"Runs"}},
			},
			"/runs/{id}/metrics": map[string]interface{}{
				"get": map[string]interface{}{"summary": "Run live/historical metrics", "tags": []string{"Runs"}},
			},
			"/schedules": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List schedules", "tags": []string{"Schedules"}},
				"post": map[string]interface{}{"summary": "Create schedule", "tags": []string{"Schedules"}},
			},
			"/sla/thresholds": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List SLA thresholds", "tags": []string{"SLA"}},
				"post": map[string]interface{}{"summary": "Create SLA threshold", "tags": []string{"SLA"}},
			},
			"/sla/results": map[string]interface{}{
				"get": map[string]interface{}{"summary": "List SLA evaluation results", "tags": []string{"SLA"}},
			},
			"/templates": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List test templates", "tags": []string{"Templates"}},
				"post": map[string]interface{}{"summary": "Create template", "tags": []string{"Templates"}},
			},
			"/api-keys": map[string]interface{}{
				"get":  map[string]interface{}{"summary": "List API keys", "tags": []string{"API Keys"}},
				"post": map[string]interface{}{"summary": "Create API key", "tags": []string{"API Keys"}},
			},
			"/audit": map[string]interface{}{
				"get": map[string]interface{}{"summary": "List audit logs", "tags": []string{"Audit"}},
			},
			"/cost/estimate": map[string]interface{}{
				"post": map[string]interface{}{"summary": "Estimate run cost", "tags": []string{"Cost"}},
			},
			"/ai/recommend": map[string]interface{}{
				"post": map[string]interface{}{"summary": "AI load profile recommendation", "tags": []string{"AI"}},
			},
			"/ai/anomaly": map[string]interface{}{
				"post": map[string]interface{}{"summary": "Anomaly detection", "tags": []string{"AI"}},
			},
			"/regions": map[string]interface{}{
				"get": map[string]interface{}{"summary": "List load-generation regions", "tags": []string{"Regions"}},
			},
			"/openapi.json": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":  "OpenAPI document",
					"security": []interface{}{},
					"tags":     []string{"Meta"},
				},
			},
			"/runs/live": map[string]interface{}{
				"get": map[string]interface{}{"summary": "Live metrics for active runs", "tags": []string{"Runs"}},
			},
			"/execution/status": map[string]interface{}{
				"get": map[string]interface{}{"summary": "Engine mode and K8s readiness", "tags": []string{"Execution"}},
			},
			"/execution/jobs": map[string]interface{}{
				"get": map[string]interface{}{"summary": "List Kubernetes execution jobs", "tags": []string{"Execution"}},
			},
		},
	}
}
