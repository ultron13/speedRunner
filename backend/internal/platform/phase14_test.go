package platform

import (
	"testing"
	"time"
)

func TestPhase14Enterprise20(t *testing.T) {
	if len(WorkspaceTemplates()) < 3 {
		t.Fatal("templates")
	}
	if !SecretRotationDue(SecretRotation{
		LastRotated: time.Now().Add(-40 * 24 * time.Hour), IntervalDays: 30,
	}, time.Now()) {
		t.Fatal("rotation due")
	}
	as := NewAnnotationStore()
	as.Add(RunAnnotation{ID: "1", RunID: "r1", Author: "a", Body: "note"})
	if len(as.List("r1")) != 1 {
		t.Fatal("ann")
	}
	frozen, _ := InFreezeWindow(time.Now(), []FreezeWindow{{
		StartsAt: time.Now().Add(-time.Hour), EndsAt: time.Now().Add(time.Hour),
		Scopes: []string{"prod"}, Reason: "black Friday",
	}}, "prod")
	if !frozen {
		t.Fatal("freeze")
	}
	impacted := ImpactedServices([]DependencyEdge{
		{From: "api", To: "checkout"}, {From: "checkout", To: "payments"},
	}, "api")
	if len(impacted) != 2 {
		t.Fatal(impacted)
	}
	sc := EngineeringScore(ScorecardInput{SLAPassRate: 95, MeanErrorRate: 0.5, P95TrendPct: -5, CoveragePct: 80})
	if sc["grade"] == "" {
		t.Fatal(sc)
	}
	exp := Experiment{Status: "running", Percent: 100, VariantA: "A", VariantB: "B"}
	if ExperimentBucket(exp, "u1") != "B" {
		t.Fatal("bucket")
	}
	csv := ExportAuditCSV([]map[string]string{{"timestamp": "t", "actor": "a", "action": "x", "resource": "r", "ip": "1"}})
	if !contains(csv, "timestamp") {
		t.Fatal(csv)
	}
	dlq := NewDeadLetterQueue()
	dlq.Enqueue(DeadLetter{ID: "d1", Target: "slack", LastError: "500"})
	if len(dlq.List()) != 1 {
		t.Fatal("dlq")
	}
	if _, ok := dlq.Requeue("d1"); !ok {
		t.Fatal("requeue")
	}
	ordered := SuitePackOrder(SuitePack{TestIDs: []string{"a", "b"}}, map[string]int{"b": 10, "a": 1})
	if ordered[0] != "b" {
		t.Fatal(ordered)
	}
	promo := EvaluatePromotion(PromotionRequest{FromEnv: "staging", ToEnv: "prod", SLAPass: true, ErrorRate: 0.2, P95Ms: 200})
	if promo["allowed"] != true {
		t.Fatal(promo)
	}
	scan := SecretScanScript("password=supersecret")
	if scan["passed"] != false {
		t.Fatal(scan)
	}
	if !IPAllowedByList("10.1.2.3", IPAllowlist{CIDRs: []string{"10.0.0.0/8"}}) {
		t.Fatal("allow")
	}
	if IPAllowedByList("8.8.8.8", IPAllowlist{CIDRs: []string{"10.0.0.0/8"}}) {
		t.Fatal("deny")
	}
	if len(Phase14Catalog()) != 20 {
		t.Fatalf("want 20 got %d", len(Phase14Catalog()))
	}
}
