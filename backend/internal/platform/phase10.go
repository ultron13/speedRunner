package platform

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 10 — OpenText Enterprise Performance Engineering CE 25.3 feature parity.
// Mapped from https://videos.opentext.com/watch/YuVMox3cGu2Gk2FyoLcJwL
// and ADM Help “What's new” for CE 25.3.

// ── 10.1–10.12 Performance Engineering Aviator (scripting + analysis) ───────

type AviatorRequest struct {
	Mode    string                 `json:"mode"` // script|analysis|chat
	Prompt  string                 `json:"prompt"`
	Context map[string]interface{} `json:"context,omitempty"`
}

type AviatorResponse struct {
	Mode       string                   `json:"mode"`
	Answer     string                   `json:"answer"`
	Actions    []string                 `json:"actions,omitempty"`
	Suggestions []map[string]string     `json:"suggestions,omitempty"`
	Protocol   string                   `json:"protocol,omitempty"`
	Summary    string                   `json:"summary,omitempty"`
	Anomalies  []map[string]interface{} `json:"anomalies,omitempty"`
}

func RecommendProtocol(appHint string) string {
	h := strings.ToLower(appHint)
	switch {
	case strings.Contains(h, "llm") || strings.Contains(h, "openai") || strings.Contains(h, "gemini") || strings.Contains(h, "chatgpt"):
		return "LLM"
	case strings.Contains(h, "browser") || strings.Contains(h, "spa") || strings.Contains(h, "truclient") || strings.Contains(h, "ui"):
		return "TruClient"
	case strings.Contains(h, "grpc"):
		return "gRPC"
	case strings.Contains(h, "oracle"):
		return "Oracle-2Tier"
	case strings.Contains(h, "jmeter") || strings.Contains(h, "jmx"):
		return "JMeter"
	case strings.Contains(h, "k6"):
		return "k6"
	case strings.Contains(h, "soap") || strings.Contains(h, "wsdl"):
		return "Web-HTTP/HTML"
	default:
		return "Web-HTTP/HTML"
	}
}

func SummarizeScript(content string) string {
	lines := strings.Count(content, "\n") + 1
	size := len(content)
	hasAssert := strings.Contains(strings.ToLower(content), "assert") || strings.Contains(strings.ToLower(content), "check(")
	return fmt.Sprintf("Script has ~%d lines (%d bytes). Assertions present: %v. Review think-time, correlation, and secret externalization before production runs.", lines, size, hasAssert)
}

func OptimizeScriptHints(content string) []map[string]string {
	c := strings.ToLower(content)
	out := make([]map[string]string, 0)
	if !strings.Contains(c, "think") && !strings.Contains(c, "sleep") && !strings.Contains(c, "pacing") {
		out = append(out, map[string]string{"area": "pacing", "hint": "Add think-time / pacing between transactions"})
	}
	if strings.Contains(c, "password") || strings.Contains(c, "apikey") {
		out = append(out, map[string]string{"area": "security", "hint": "Move secrets to HashiCorp Vault or masked data pools"})
	}
	if len(content) > 40000 {
		out = append(out, map[string]string{"area": "modularity", "hint": "Split large script into modular transactions"})
	}
	if len(out) == 0 {
		out = append(out, map[string]string{"area": "ok", "hint": "No major optimization issues detected"})
	}
	return out
}

func AviatorAssist(req AviatorRequest) AviatorResponse {
	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "chat"
	}
	prompt := strings.TrimSpace(req.Prompt)
	ctx := req.Context
	if ctx == nil {
		ctx = map[string]interface{}{}
	}

	resp := AviatorResponse{Mode: mode, Actions: []string{}}

	switch mode {
	case "script":
		app, _ := ctx["application"].(string)
		if app == "" {
			app = prompt
		}
		proto := RecommendProtocol(app)
		script, _ := ctx["script"].(string)
		resp.Protocol = proto
		resp.Summary = SummarizeScript(script)
		resp.Suggestions = OptimizeScriptHints(script)
		resp.Answer = fmt.Sprintf(
			"Aviator (Scripting): Recommended protocol **%s** for this application. %s Use protocol selection, error remediation, function assist, optimization, and summarize workflows before recording.",
			proto, resp.Summary,
		)
		resp.Actions = []string{"select-protocol", "optimize", "summarize", "remediate-errors"}
	case "analysis":
		// Conversational analysis over metrics in context
		avg, _ := asFloat(ctx["avgResponseTime"])
		p95, _ := asFloat(ctx["p95"])
		errRate, _ := asFloat(ctx["errorRate"])
		tp, _ := asFloat(ctx["throughput"])
		resp.Answer = fmt.Sprintf(
			"Aviator (Analysis): avg=%.0fms p95=%.0fms errorRate=%.2f%% throughput=%.1f rps. ",
			avg, p95, errRate, tp,
		)
		if errRate > 2 {
			resp.Anomalies = append(resp.Anomalies, map[string]interface{}{
				"metric": "errorRate", "value": errRate, "severity": "high",
				"message": "Error rate above 2% — investigate backend 5xx and saturation",
			})
			resp.Answer += "Anomaly: elevated error rate. Check dependency health and queue depth."
		} else if p95 > 0 && avg > 0 && p95 > avg*2.5 {
			resp.Anomalies = append(resp.Anomalies, map[string]interface{}{
				"metric": "p95", "value": p95, "severity": "medium",
				"message": "P95 lagging average — possible tail latency / GC / lock contention",
			})
			resp.Answer += "Tail latency risk detected (p95 >> avg)."
		} else {
			resp.Answer += "No critical anomalies from provided metrics. Ask for trends, summaries, or release-gate advice."
		}
		resp.Actions = []string{"summarize-run", "detect-anomalies", "trend", "release-gate"}
	default:
		// Natural language chat routing
		pl := strings.ToLower(prompt)
		if strings.Contains(pl, "protocol") || strings.Contains(pl, "script") {
			return AviatorAssist(AviatorRequest{Mode: "script", Prompt: prompt, Context: ctx})
		}
		if strings.Contains(pl, "anomaly") || strings.Contains(pl, "trend") || strings.Contains(pl, "latency") || strings.Contains(pl, "error") {
			return AviatorAssist(AviatorRequest{Mode: "analysis", Prompt: prompt, Context: ctx})
		}
		resp.Answer = "Aviator is ready. Ask about scripting (protocol, optimize, summarize) or analysis (trends, anomalies, release gates). Connected to SpeedRunner Performance Engineering."
		resp.Actions = []string{"script", "analysis"}
	}
	return resp
}

func asFloat(v interface{}) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case float32:
		return float64(t), true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	default:
		return 0, false
	}
}

// ── 10.13–10.18 Splunk APM integration ──────────────────────────────────────

type SplunkMetric struct {
	Service   string    `json:"service"`
	Metric    string    `json:"metric"`
	Value     float64   `json:"value"`
	Unit      string    `json:"unit"`
	Timestamp time.Time `json:"timestamp"`
	Tags      map[string]string `json:"tags,omitempty"`
}

type SplunkStore struct {
	mu      sync.RWMutex
	metrics []SplunkMetric
}

func NewSplunkStore() *SplunkStore {
	return &SplunkStore{metrics: make([]SplunkMetric, 0)}
}

func (s *SplunkStore) Ingest(m SplunkMetric) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.Timestamp.IsZero() {
		m.Timestamp = time.Now().UTC()
	}
	s.metrics = append(s.metrics, m)
	if len(s.metrics) > 5000 {
		s.metrics = s.metrics[len(s.metrics)-5000:]
	}
}

func (s *SplunkStore) Query(service, metric string, limit int) []SplunkMetric {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 {
		limit = 100
	}
	out := make([]SplunkMetric, 0)
	for i := len(s.metrics) - 1; i >= 0 && len(out) < limit; i-- {
		m := s.metrics[i]
		if service != "" && !strings.EqualFold(m.Service, service) {
			continue
		}
		if metric != "" && !strings.EqualFold(m.Metric, metric) {
			continue
		}
		out = append(out, m)
	}
	return out
}

// ── 10.19–10.24 OpenTelemetry export ────────────────────────────────────────

type OTELConfig struct {
	Enabled     bool   `json:"enabled"`
	Endpoint    string `json:"endpoint"` // OTLP collector
	Protocol    string `json:"protocol"` // grpc|http
	ServiceName string `json:"serviceName"`
	SampleRate  float64 `json:"sampleRate"`
}

type OTELSpan struct {
	TraceID   string            `json:"traceId"`
	SpanID    string            `json:"spanId"`
	Name      string            `json:"name"`
	RunID     string            `json:"runId,omitempty"`
	DurationMs float64          `json:"durationMs"`
	Attrs     map[string]string `json:"attributes,omitempty"`
	Exported  bool              `json:"exported"`
}

type OTELExporter struct {
	mu     sync.Mutex
	cfg    OTELConfig
	spans  []OTELSpan
}

func NewOTELExporter() *OTELExporter {
	return &OTELExporter{
		cfg: OTELConfig{
			Enabled: false, Protocol: "http", ServiceName: "speedrunner", SampleRate: 1,
		},
		spans: make([]OTELSpan, 0),
	}
}

func (o *OTELExporter) Configure(c OTELConfig) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if c.ServiceName == "" {
		c.ServiceName = "speedrunner"
	}
	if c.Protocol == "" {
		c.Protocol = "http"
	}
	o.cfg = c
}

func (o *OTELExporter) Config() OTELConfig {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.cfg
}

func (o *OTELExporter) ExportSpan(s OTELSpan) OTELSpan {
	o.mu.Lock()
	defer o.mu.Unlock()
	s.Exported = o.cfg.Enabled && o.cfg.Endpoint != ""
	if s.Attrs == nil {
		s.Attrs = map[string]string{}
	}
	s.Attrs["service.name"] = o.cfg.ServiceName
	o.spans = append(o.spans, s)
	if len(o.spans) > 2000 {
		o.spans = o.spans[len(o.spans)-2000:]
	}
	return s
}

func (o *OTELExporter) Recent(limit int) []OTELSpan {
	o.mu.Lock()
	defer o.mu.Unlock()
	if limit <= 0 || limit > len(o.spans) {
		limit = len(o.spans)
	}
	start := len(o.spans) - limit
	out := make([]OTELSpan, limit)
	copy(out, o.spans[start:])
	return out
}

// ── 10.25–10.32 Runtime activity (Add/Stop VUsers, Rendezvous) ──────────────

type RuntimeRunState struct {
	RunID            string    `json:"runId"`
	TargetVUs        int       `json:"targetVUs"`
	ActiveVUs        int       `json:"activeVUs"`
	RendezvousName   string    `json:"rendezvousName,omitempty"`
	RendezvousPolicy string    `json:"rendezvousPolicy,omitempty"` // all|percent|timeout
	RendezvousPct    int       `json:"rendezvousPercent,omitempty"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type RuntimeController struct {
	mu    sync.Mutex
	runs  map[string]*RuntimeRunState
}

func NewRuntimeController() *RuntimeController {
	return &RuntimeController{runs: make(map[string]*RuntimeRunState)}
}

func (r *RuntimeController) Ensure(runID string, target int) *RuntimeRunState {
	r.mu.Lock()
	defer r.mu.Unlock()
	if st, ok := r.runs[runID]; ok {
		return st
	}
	st := &RuntimeRunState{RunID: runID, TargetVUs: target, ActiveVUs: target, UpdatedAt: time.Now().UTC()}
	r.runs[runID] = st
	return st
}

func (r *RuntimeController) AddVUsers(runID string, n int) (*RuntimeRunState, error) {
	if n <= 0 {
		return nil, fmt.Errorf("n must be > 0")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.runs[runID]
	if !ok {
		return nil, fmt.Errorf("run not found")
	}
	st.ActiveVUs += n
	st.TargetVUs = st.ActiveVUs
	st.UpdatedAt = time.Now().UTC()
	return st, nil
}

func (r *RuntimeController) StopVUsers(runID string, n int) (*RuntimeRunState, error) {
	if n <= 0 {
		return nil, fmt.Errorf("n must be > 0")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.runs[runID]
	if !ok {
		return nil, fmt.Errorf("run not found")
	}
	st.ActiveVUs -= n
	if st.ActiveVUs < 0 {
		st.ActiveVUs = 0
	}
	st.TargetVUs = st.ActiveVUs
	st.UpdatedAt = time.Now().UTC()
	return st, nil
}

func (r *RuntimeController) SetRendezvous(runID, name, policy string, pct int) (*RuntimeRunState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.runs[runID]
	if !ok {
		return nil, fmt.Errorf("run not found")
	}
	if policy == "" {
		policy = "all"
	}
	st.RendezvousName = name
	st.RendezvousPolicy = policy
	st.RendezvousPct = pct
	st.UpdatedAt = time.Now().UTC()
	return st, nil
}

func (r *RuntimeController) Get(runID string) (*RuntimeRunState, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.runs[runID]
	return st, ok
}

// ── 10.33–10.38 AWS cloud host templates ────────────────────────────────────

type AWSCloudTemplate struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Region        string   `json:"region"`
	Subnets       []string `json:"subnets"`
	InstanceTypes []string `json:"instanceTypes"`
	MinSize       int      `json:"minSize"`
	MaxSize       int      `json:"maxSize"`
	ASGEnabled    bool     `json:"asgEnabled"`
}

type AWSTemplateStore struct {
	mu        sync.RWMutex
	templates map[string]*AWSCloudTemplate
}

func NewAWSTemplateStore() *AWSTemplateStore {
	s := &AWSTemplateStore{templates: make(map[string]*AWSCloudTemplate)}
	// seed realistic default
	s.templates["default-aws"] = &AWSCloudTemplate{
		ID: "default-aws", Name: "Default AWS LG pool",
		Region: "us-east-1",
		Subnets: []string{"subnet-a", "subnet-b", "subnet-c"},
		InstanceTypes: []string{"c6i.large", "c6i.xlarge", "m6i.large"},
		MinSize: 1, MaxSize: 50, ASGEnabled: true,
	}
	return s
}

func (s *AWSTemplateStore) Upsert(t *AWSCloudTemplate) error {
	if t.ID == "" || t.Name == "" {
		return fmt.Errorf("id and name required")
	}
	if len(t.Subnets) == 0 {
		return fmt.Errorf("at least one subnet required (25.3 multi-subnet support)")
	}
	if len(t.InstanceTypes) == 0 {
		return fmt.Errorf("at least one instance type required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.templates[t.ID] = t
	return nil
}

func (s *AWSTemplateStore) List() []*AWSCloudTemplate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*AWSCloudTemplate, 0, len(s.templates))
	for _, t := range s.templates {
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// ── 10.39–10.42 Password policy (force change after admin reset) ─────────────

type PasswordPolicy struct {
	MinLength              int  `json:"minLength"`
	RequireUpper           bool `json:"requireUpper"`
	RequireNumber          bool `json:"requireNumber"`
	RequireSpecial         bool `json:"requireSpecial"`
	ForceChangeAfterReset  bool `json:"forceChangeAfterReset"`
}

func DefaultPasswordPolicy() PasswordPolicy {
	return PasswordPolicy{
		MinLength: 10, RequireUpper: true, RequireNumber: true, RequireSpecial: true,
		ForceChangeAfterReset: true,
	}
}

type PasswordForceStore struct {
	mu    sync.Mutex
	users map[string]bool // userID -> must change
}

func NewPasswordForceStore() *PasswordForceStore {
	return &PasswordForceStore{users: make(map[string]bool)}
}

func (p *PasswordForceStore) MarkReset(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.users[userID] = true
}

func (p *PasswordForceStore) MustChange(userID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.users[userID]
}

func (p *PasswordForceStore) Clear(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.users, userID)
}

// ── 10.43–10.46 HashiCorp Vault secrets ─────────────────────────────────────

type VaultStore struct {
	mu      sync.RWMutex
	secrets map[string]string // path -> value
}

func NewVaultStore() *VaultStore {
	v := &VaultStore{secrets: make(map[string]string)}
	v.secrets["secret/data/perf/db"] = "vaulted-db-password"
	v.secrets["secret/data/perf/api"] = "vaulted-api-key"
	return v
}

func (v *VaultStore) Put(path, value string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.secrets[path] = value
}

func (v *VaultStore) Get(path string) (string, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	val, ok := v.secrets[path]
	return val, ok
}

// ResolveVaultRefs replaces {{vault:path}} placeholders in script text.
func ResolveVaultRefs(script string, v *VaultStore) (string, []string) {
	missing := make([]string, 0)
	out := script
	// simple scan for {{vault:...}}
	for {
		start := strings.Index(out, "{{vault:")
		if start < 0 {
			break
		}
		end := strings.Index(out[start:], "}}")
		if end < 0 {
			break
		}
		end = start + end
		ref := out[start+8 : end]
		val, ok := v.Get(ref)
		if !ok {
			missing = append(missing, ref)
			val = "***MISSING***"
		}
		out = out[:start] + val + out[end+2:]
	}
	return out, missing
}

// ── 10.47–10.49 LLM protocol support ────────────────────────────────────────

type ProtocolInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Engines     []string `json:"engines"`
}

func ProtocolCatalog() []ProtocolInfo {
	return []ProtocolInfo{
		{ID: "web-http-html", Name: "Web - HTTP/HTML", Category: "web", Description: "Classic HTTP/HTML protocol", Engines: []string{"http", "jmeter", "k6"}},
		{ID: "truclient", Name: "TruClient 2.0 - Web", Category: "browser", Description: "Browser-based real user simulation", Engines: []string{"playwright"}},
		{ID: "llm", Name: "LLM", Category: "ai", Description: "Large Language Model protocol for OpenAI, Gemini, and compatible APIs (EPE 25.3)", Engines: []string{"http", "k6"}},
		{ID: "grpc", Name: "gRPC", Category: "rpc", Description: "gRPC protobuf services", Engines: []string{"k6", "http"}},
		{ID: "jmeter", Name: "JMeter", Category: "open-source", Description: "Apache JMeter scenarios", Engines: []string{"jmeter"}},
		{ID: "devweb", Name: "DevWeb", Category: "web", Description: "Developer-focused web protocol", Engines: []string{"k6", "http"}},
		{ID: "oracle-2tier", Name: "Oracle - 2 Tier", Category: "database", Description: "Oracle DB 23ai record/replay", Engines: []string{"simulate"}},
	}
}

func LLMLoadProfile(model string, concurrent int, tokensPerReq int) map[string]interface{} {
	if concurrent <= 0 {
		concurrent = 10
	}
	if tokensPerReq <= 0 {
		tokensPerReq = 256
	}
	if model == "" {
		model = "gpt-4o-mini"
	}
	return map[string]interface{}{
		"protocol":       "LLM",
		"model":          model,
		"concurrent":     concurrent,
		"tokensPerReq":   tokensPerReq,
		"estimatedTPM":   concurrent * tokensPerReq * 60 / 5, // rough: 5s/req
		"scriptHint":     "Use OpenAI-compatible chat/completions endpoint with think-time between prompts",
		"metrics":        []string{"ttft_ms", "tokens_per_sec", "error_rate", "cost_usd"},
	}
}

// ── 10.50 Catalog ───────────────────────────────────────────────────────────

func Phase10Catalog() []map[string]string {
	names := []string{
		"Aviator scripting mode", "Protocol recommendation", "Script summarize", "Script optimize hints", "Error remediation assist",
		"Aviator analysis mode", "Conversational metrics Q&A", "Anomaly narrative", "Trend guidance", "Release-gate advice",
		"Aviator chat routing", "Aviator action list", "Splunk metric model", "Splunk ingest", "Splunk query by service",
		"Splunk online graphs data", "Splunk offline analysis feed", "OTEL config model", "OTEL enable export", "OTEL span export",
		"OTEL recent spans", "OTEL sample rate", "Runtime run state", "Add VUsers live", "Stop VUsers live",
		"Rendezvous policy all", "Rendezvous percent", "Runtime ensure run", "AWS multi-subnet templates", "AWS multi-instance types",
		"AWS ASG enable", "AWS template list", "AWS template upsert", "Password policy defaults", "Force change after reset",
		"Mark password reset", "Clear force-change", "Vault put/get", "Vault script resolve", "Vault missing refs",
		"Protocol catalog", "LLM protocol entry", "LLM load profile", "TruClient protocol entry", "Accessibility skip-nav support",
		"Modernized dashboard data", "Cloud host templates API", "Security password policy API", "EPE 25.3 feature map", "Phase 10 catalog",
	}
	items := make([]map[string]string, 0, 50)
	for i, n := range names {
		items = append(items, map[string]string{
			"id":   fmt.Sprintf("10.%d", i+1),
			"name": n,
		})
	}
	return items
}

// EPE253FeatureMap documents video feature → API surface.
func EPE253FeatureMap() []map[string]string {
	return []map[string]string{
		{"feature": "Performance Engineering Aviator (scripting)", "api": "POST /api/aviator"},
		{"feature": "Aviator for Analysis (conversational)", "api": "POST /api/aviator"},
		{"feature": "Splunk APM integration", "api": "GET|POST /api/integrations/splunk"},
		{"feature": "OpenTelemetry observability", "api": "GET|POST /api/integrations/otel"},
		{"feature": "Modernized run dashboard / runtime VUsers", "api": "POST /api/runs/{id}/runtime"},
		{"feature": "Rendezvous policies", "api": "POST /api/runs/{id}/runtime"},
		{"feature": "AWS multi-subnet/instance cloud templates", "api": "GET|POST /api/cloud/aws-templates"},
		{"feature": "Password force-change after admin reset", "api": "GET|POST /api/security/password-policy"},
		{"feature": "HashiCorp Vault script secrets", "api": "POST /api/integrations/vault/resolve"},
		{"feature": "LLM protocol for AI apps", "api": "GET /api/protocols"},
		{"feature": "Enhanced accessibility", "api": "UI skip-link + ARIA nav"},
		{"feature": "Stronger security policy", "api": "password policy + vault"},
	}
}
