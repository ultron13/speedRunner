package enterprise

import "testing"

func TestReadinessAndGolden(t *testing.T) {
	checks := CheckEnvironmentReadiness("https://example.com", true, true, false)
	if len(checks) < 3 {
		t.Fatal(checks)
	}
	if len(GoldenTemplates()) < 5 {
		t.Fatal("golden templates")
	}
	if len(ChaosCatalog()) < 2 {
		t.Fatal("chaos")
	}
}

func TestBaselinesQuotas(t *testing.T) {
	bs := NewBaselineStore()
	bs.Propose(&Baseline{ID: "b1", Name: "base", TestID: "t1", AvgRT: 100})
	if err := bs.Approve("b1", "admin"); err != nil {
		t.Fatal(err)
	}
	list := bs.List()
	if len(list) != 1 || list[0].Status != "APPROVED" {
		t.Fatalf("%+v", list)
	}
	q := NewQuotaStore()
	ok, _ := q.Check("commerce", 100, 1)
	if !ok {
		t.Fatal("quota")
	}
	ok, _ = q.Check("commerce", 99999, 1)
	if ok {
		t.Fatal("should reject VU")
	}
}

func TestImpactDriftContract(t *testing.T) {
	imp := ImpactAnalysis([]string{"checkout"}, []string{"/pay"}, []string{"Checkout Performance", "Login"})
	if imp["risk"] == nil {
		t.Fatal(imp)
	}
	drift := DetectEnvDrift(
		EnvSnapshot{ConfigHash: "a", Images: map[string]string{"api": "1"}, Replicas: map[string]int{"api": 2}},
		EnvSnapshot{ConfigHash: "b", Images: map[string]string{"api": "2"}, Replicas: map[string]int{"api": 3}},
	)
	if drift["hasDrift"] != true {
		t.Fatal(drift)
	}
	ok, _ := EnforceResidency(ResidencyPolicy{Region: "eu", BlockCrossRegion: true}, "us", "eu")
	if ok {
		t.Fatal("should block")
	}
	plan := BuildCleanupPlan(12)
	if len(plan.Actions) == 0 {
		t.Fatal(plan)
	}
	vr := NewVirtualRegistry()
	vr.Register(&VirtualService{ID: "1", Name: "mock-pay", BaseURL: "http://mock", Replaces: "payments"})
	if u, ok := vr.Resolve("payments"); !ok || u == "" {
		t.Fatal("resolve")
	}
}
