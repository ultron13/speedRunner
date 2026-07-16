package policy

import "testing"

func TestMaxLoadAndTargets(t *testing.T) {
	pe := DefaultEnterpriseEngine(100)
	res, err := pe.Evaluate(nil, ExecutionRequest{VirtualUsers: 200, TargetURL: "https://api.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Allowed {
		t.Fatal("expected reject for max load")
	}
	res2, _ := pe.Evaluate(nil, ExecutionRequest{VirtualUsers: 10, TargetURL: "http://169.254.169.254/"})
	if res2.Allowed {
		t.Fatal("expected blocked metadata host")
	}
}

func TestApprovalRule(t *testing.T) {
	r := ApprovalRule{VUThreshold: 100}
	if r.Evaluate(ExecutionRequest{VirtualUsers: 50, UserRole: "QA"}) != nil {
		t.Fatal("should allow low VU")
	}
	if r.Evaluate(ExecutionRequest{VirtualUsers: 500, UserRole: "QA"}) == nil {
		t.Fatal("should require approval role")
	}
	if r.Evaluate(ExecutionRequest{VirtualUsers: 500, UserRole: "PLATFORM_ADMIN"}) != nil {
		t.Fatal("admin should pass")
	}
}
