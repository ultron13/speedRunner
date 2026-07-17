package platform

import (
	"testing"
)

func TestAviatorScriptAnalysis(t *testing.T) {
	if RecommendProtocol("openai chatbot") != "LLM" {
		t.Fatal("llm")
	}
	if RecommendProtocol("checkout spa browser") != "TruClient" {
		t.Fatal("truclient")
	}
	sum := SummarizeScript("line1\ncheck(res)")
	if sum == "" {
		t.Fatal("summary")
	}
	hints := OptimizeScriptHints("password=secret")
	if len(hints) == 0 {
		t.Fatal("hints")
	}
	script := AviatorAssist(AviatorRequest{Mode: "script", Prompt: "REST API shop", Context: map[string]interface{}{"script": "http.get"}})
	if script.Protocol == "" || script.Answer == "" {
		t.Fatal(script)
	}
	analysis := AviatorAssist(AviatorRequest{
		Mode: "analysis",
		Context: map[string]interface{}{
			"avgResponseTime": 100.0, "p95": 400.0, "errorRate": 3.5, "throughput": 50.0,
		},
	})
	if len(analysis.Anomalies) == 0 {
		t.Fatal(analysis)
	}
	chat := AviatorAssist(AviatorRequest{Mode: "chat", Prompt: "what protocol for grpc?"})
	if chat.Answer == "" {
		t.Fatal(chat)
	}
}

func TestSplunkOTELRuntime(t *testing.T) {
	sp := NewSplunkStore()
	sp.Ingest(SplunkMetric{Service: "checkout", Metric: "latency.p95", Value: 220, Unit: "ms"})
	q := sp.Query("checkout", "latency.p95", 10)
	if len(q) != 1 {
		t.Fatal(q)
	}
	otel := NewOTELExporter()
	otel.Configure(OTELConfig{Enabled: true, Endpoint: "http://otel:4318", ServiceName: "sr"})
	span := otel.ExportSpan(OTELSpan{TraceID: "t1", SpanID: "s1", Name: "run", DurationMs: 12})
	if !span.Exported {
		t.Fatal(span)
	}
	if len(otel.Recent(5)) != 1 {
		t.Fatal("recent")
	}
	rt := NewRuntimeController()
	rt.Ensure("r1", 100)
	st, err := rt.AddVUsers("r1", 20)
	if err != nil || st.ActiveVUs != 120 {
		t.Fatal(st, err)
	}
	st, err = rt.StopVUsers("r1", 30)
	if err != nil || st.ActiveVUs != 90 {
		t.Fatal(st, err)
	}
	st, err = rt.SetRendezvous("r1", "checkout", "percent", 80)
	if err != nil || st.RendezvousPct != 80 {
		t.Fatal(st, err)
	}
}

func TestAWSVaultLLMPasswordCatalog(t *testing.T) {
	aws := NewAWSTemplateStore()
	if len(aws.List()) == 0 {
		t.Fatal("seed")
	}
	err := aws.Upsert(&AWSCloudTemplate{
		ID: "t2", Name: "EU", Region: "eu-west-1",
		Subnets: []string{"s1", "s2"}, InstanceTypes: []string{"c6i.large", "c6i.xlarge"},
		MinSize: 1, MaxSize: 20, ASGEnabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if aws.Upsert(&AWSCloudTemplate{ID: "bad", Name: "x"}) == nil {
		t.Fatal("need subnets")
	}
	pol := DefaultPasswordPolicy()
	if !pol.ForceChangeAfterReset {
		t.Fatal("force")
	}
	pf := NewPasswordForceStore()
	pf.MarkReset("u1")
	if !pf.MustChange("u1") {
		t.Fatal("must")
	}
	pf.Clear("u1")
	if pf.MustChange("u1") {
		t.Fatal("cleared")
	}
	v := NewVaultStore()
	resolved, missing := ResolveVaultRefs("pwd={{vault:secret/data/perf/db}} key={{vault:missing}}", v)
	if missing[0] != "missing" {
		t.Fatal(missing)
	}
	if !contains(resolved, "vaulted-db-password") {
		t.Fatal(resolved)
	}
	protos := ProtocolCatalog()
	foundLLM := false
	for _, p := range protos {
		if p.ID == "llm" {
			foundLLM = true
		}
	}
	if !foundLLM {
		t.Fatal("llm protocol")
	}
	profile := LLMLoadProfile("gemini-pro", 20, 128)
	if profile["protocol"] != "LLM" {
		t.Fatal(profile)
	}
	if len(Phase10Catalog()) != 50 {
		t.Fatalf("catalog %d", len(Phase10Catalog()))
	}
	if len(EPE253FeatureMap()) < 10 {
		t.Fatal("feature map")
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		(len(s) > 0 && (stringIndex(s, sub) >= 0)))
}

func stringIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
