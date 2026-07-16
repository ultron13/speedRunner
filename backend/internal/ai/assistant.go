package ai

import (
	"fmt"
	"strings"
)

// ScriptReviewFinding is a static analysis style suggestion for a load script draft.
type ScriptReviewFinding struct {
	Category   string `json:"category"`
	Severity   string `json:"severity"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion"`
}

// ReviewScript performs heuristic review of script text (JMeter XML, k6 JS, etc.).
func ReviewScript(scriptType, content string) []ScriptReviewFinding {
	c := strings.ToLower(content)
	var out []ScriptReviewFinding
	if !strings.Contains(c, "assert") && !strings.Contains(c, "check(") && !strings.Contains(c, "responseassertion") {
		out = append(out, ScriptReviewFinding{
			Category: "assertion", Severity: "medium",
			Message:    "No response assertions/checks detected",
			Suggestion: "Add status-code and latency assertions for release gates",
		})
	}
	if !strings.Contains(c, "think") && !strings.Contains(c, "sleep") && !strings.Contains(c, "pacing") {
		out = append(out, ScriptReviewFinding{
			Category: "think-time", Severity: "low",
			Message:    "No think-time / sleep detected",
			Suggestion: "Add realistic think time to avoid unrealistic saturation",
		})
	}
	if strings.Contains(c, "password") || strings.Contains(c, "secret") || strings.Contains(c, "apikey") {
		out = append(out, ScriptReviewFinding{
			Category: "data-usage", Severity: "high",
			Message:    "Possible hardcoded secrets in script",
			Suggestion: "Externalize credentials into a masked data pool",
		})
	}
	if strings.EqualFold(scriptType, "JMeter") || strings.Contains(c, "httpsampler") {
		if !strings.Contains(c, "regexextractor") && !strings.Contains(c, "jsonextractor") && !strings.Contains(c, "correlation") {
			out = append(out, ScriptReviewFinding{
				Category: "correlation", Severity: "medium",
				Message:    "No correlation extractors detected",
				Suggestion: "Parameterize dynamic tokens (CSRF, session IDs) via extractors",
			})
		}
	}
	if len(content) > 50000 {
		out = append(out, ScriptReviewFinding{
			Category: "maintainability", Severity: "low",
			Message:    "Script is very large",
			Suggestion: "Split into modular transactions / modules for maintainability",
		})
	}
	if len(out) == 0 {
		out = append(out, ScriptReviewFinding{
			Category: "maintainability", Severity: "info",
			Message:    "No major issues found in heuristic review",
			Suggestion: "Still run a dry-run before production load",
		})
	}
	return out
}

// GenerateStarterScript creates a draft engine script from an OpenAPI-ish base URL + paths.
func GenerateStarterScript(engine, baseURL string, paths []string) map[string]interface{} {
	if len(paths) == 0 {
		paths = []string{"/"}
	}
	engine = strings.ToLower(engine)
	var body string
	switch engine {
	case "k6":
		body = fmt.Sprintf(`import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = { vus: 10, duration: '1m' };
export default function () {
  const res = http.get('%s%s');
  check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(1);
}
`, strings.TrimRight(baseURL, "/"), paths[0])
	case "locust":
		body = fmt.Sprintf(`from locust import HttpUser, task, between
class User(HttpUser):
    wait_time = between(1, 2)
    host = "%s"
    @task
    def hit(self):
        self.client.get("%s")
`, strings.TrimRight(baseURL, "/"), paths[0])
	case "gatling":
		body = fmt.Sprintf(`// Gatling draft — review before run
// baseUrl=%s path=%s
`, baseURL, paths[0])
	case "jmeter":
		body = fmt.Sprintf(`<!-- JMeter draft plan for %s%s — review before execution -->
`, baseURL, paths[0])
	default:
		body = fmt.Sprintf("# Draft for %s against %s\n", engine, baseURL)
	}
	return map[string]interface{}{
		"engine":     engine,
		"draft":      true,
		"warning":    "Generated script is a draft — require human review before production execution",
		"script":     body,
		"paths":      paths,
		"baseUrl":    baseURL,
		"confidence": 0.55,
	}
}

// DataPoolRecommendation suggests Redis structure for runtime data.
func DataPoolRecommendation(useCase string, estimatedUsers int) map[string]interface{} {
	prefix := "speedrunner:data:" + strings.ToLower(strings.ReplaceAll(useCase, " ", "_"))
	parts := estimatedUsers
	if parts < 10 {
		parts = 10
	}
	return map[string]interface{}{
		"keyPrefix":       prefix,
		"partitionCount":  max(1, estimatedUsers/100),
		"recommendedTTL":  3600,
		"tokenPool":       prefix + ":tokens",
		"credentialPool":  prefix + ":creds",
		"exhaustionWarnAt": 0.1,
		"masking":         true,
		"notes":           "Separate durable definitions from runtime Redis materialization",
	}
}

// GenerateSyntheticData produces simple synthetic records (masked optional).
func GenerateSyntheticData(schema map[string]string, count int, maskPII bool) []map[string]interface{} {
	if count <= 0 {
		count = 10
	}
	if count > 1000 {
		count = 1000
	}
	if len(schema) == 0 {
		schema = map[string]string{"id": "int", "email": "email", "name": "string"}
	}
	out := make([]map[string]interface{}, 0, count)
	for i := 0; i < count; i++ {
		row := map[string]interface{}{}
		for field, typ := range schema {
			switch strings.ToLower(typ) {
			case "int", "number":
				row[field] = i + 1
			case "email":
				if maskPII {
					row[field] = fmt.Sprintf("user%d@***.com", i)
				} else {
					row[field] = fmt.Sprintf("user%d@example.com", i)
				}
			default:
				row[field] = fmt.Sprintf("%s-%d", field, i)
			}
		}
		out = append(out, row)
	}
	return out
}

// RunSummary generates audience-specific narratives from run metrics.
func RunSummary(audience string, avgRT, p95, throughput, errorRate float64, status string) map[string]string {
	engineer := fmt.Sprintf("Run %s. Avg RT %.0fms (p95 %.0fms), throughput %.1f rps, errors %.2f%%.",
		status, avgRT, p95, throughput, errorRate)
	sre := engineer + " Check saturation on app, DB, and load generators if p95>500 or errors>1%."
	release := "PASS"
	risk := "low"
	if errorRate > 5 || p95 > 2000 {
		release = "FAIL"
		risk = "high"
	} else if errorRate > 1 || p95 > 800 {
		release = "WARN"
		risk = "medium"
	}
	exec := fmt.Sprintf("Release risk: %s (%s). Performance %s against internal gates.", risk, release, status)
	m := map[string]string{
		"engineer":  engineer,
		"sre":       sre,
		"release":   fmt.Sprintf("Gate %s — risk %s. Avg %.0fms / err %.2f%%.", release, risk, avgRT, errorRate),
		"executive": exec,
	}
	if a := strings.ToLower(audience); a != "" && m[a] != "" {
		return map[string]string{"audience": a, "summary": m[a], "gate": release, "risk": risk}
	}
	m["gate"] = release
	m["risk"] = risk
	return m
}

// ReleaseGate decides pass/fail with multi-signal reasoning.
func ReleaseGate(avgRT, baselineRT, errorRate, throughput float64, anomalyCount int) map[string]interface{} {
	reasons := []string{}
	passed := true
	if errorRate > 5 {
		passed = false
		reasons = append(reasons, "error rate exceeds 5%")
	}
	if avgRT > 1000 {
		passed = false
		reasons = append(reasons, "avg response time exceeds 1000ms")
	}
	if baselineRT > 0 && avgRT > baselineRT*1.2 {
		passed = false
		reasons = append(reasons, "avg RT regressed >20% vs baseline")
	}
	if anomalyCount > 3 {
		passed = false
		reasons = append(reasons, fmt.Sprintf("%d anomalies detected during run", anomalyCount))
	}
	if throughput < 1 {
		reasons = append(reasons, "very low throughput — verify target health")
	}
	if len(reasons) == 0 {
		reasons = append(reasons, "all automated gates passed")
	}
	risk := "low"
	if !passed {
		risk = "high"
	} else if anomalyCount > 0 || (baselineRT > 0 && avgRT > baselineRT*1.1) {
		risk = "medium"
	}
	return map[string]interface{}{
		"passed":  passed,
		"risk":    risk,
		"reasons": reasons,
		"explanation": strings.Join(reasons, "; "),
	}
}

// ForecastCapacity estimates capacity from observed throughput per VU.
func ForecastCapacity(currentVUs int, observedRPS, targetRPS float64) map[string]interface{} {
	if currentVUs <= 0 {
		currentVUs = 1
	}
	rpsPerVU := observedRPS / float64(currentVUs)
	if rpsPerVU <= 0 {
		rpsPerVU = 0.8
	}
	needed := int(targetRPS/rpsPerVU + 0.999)
	if needed < 1 {
		needed = 1
	}
	return map[string]interface{}{
		"rpsPerVu":           rpsPerVU,
		"recommendedVUs":     needed,
		"targetRps":          targetRPS,
		"workersEstimate":    max(1, needed/50),
		"confidence":         0.6,
		"scalingSuggestion":  fmt.Sprintf("Scale to ~%d VUs (~%d workers @ 50 VU)", needed, max(1, needed/50)),
	}
}

// OperationalAssist gives troubleshooting hints for a failed/slow run.
func OperationalAssist(status string, errorRate, avgRT float64, logSnippet string) map[string]interface{} {
	steps := []string{
		"Confirm target health and readiness probes",
		"Compare p95/p99 vs previous baseline",
		"Inspect load generator CPU/memory",
	}
	if errorRate > 2 {
		steps = append(steps, "Investigate 4xx/5xx distribution and dependency timeouts")
	}
	if avgRT > 800 {
		steps = append(steps, "Check DB slow queries and cache hit ratio")
	}
	if strings.Contains(strings.ToLower(logSnippet), "timeout") {
		steps = append(steps, "Increase timeouts or scale target pods; verify network policies")
	}
	hyp := "Possible saturation or dependency latency under concurrency"
	if errorRate > 10 {
		hyp = "Likely functional failure or misconfiguration (high error rate)"
	}
	return map[string]interface{}{
		"status":           status,
		"hypothesis":       hyp,
		"nextSteps":        steps,
		"dashboardHints":   []string{"response time", "error rate", "throughput", "infrastructure"},
		"logRecommendation": "Filter logs by run_id / trace_id correlation headers",
	}
}

// DefectDraft builds a Jira/ServiceNow-ready incident draft.
func DefectDraft(title string, severity string, evidence []string, owner string) map[string]interface{} {
	if severity == "" {
		severity = "medium"
	}
	if owner == "" {
		owner = "performance-team"
	}
	body := title + "\n\nEvidence:\n"
	for _, e := range evidence {
		body += "- " + e + "\n"
	}
	return map[string]interface{}{
		"jira": map[string]interface{}{
			"project":     "PERF",
			"issuetype":   "Bug",
			"summary":     title,
			"description": body,
			"priority":    severity,
			"assignee":    owner,
			"labels":      []string{"speedrunner", "performance"},
		},
		"serviceNow": map[string]interface{}{
			"short_description": title,
			"description":       body,
			"urgency":           severity,
			"assignment_group":  owner,
			"category":          "Performance",
		},
		"evidenceLinks": evidence,
		"suggestedSeverity": severity,
		"suggestedOwner":    owner,
	}
}


