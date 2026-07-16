package policy

import (
	"fmt"
	"net/url"
	"strings"
)

// MaxLoadRule rejects executions above a VU ceiling.
type MaxLoadRule struct {
	MaxVUs int
}

func (r MaxLoadRule) Evaluate(req ExecutionRequest) *Violation {
	max := r.MaxVUs
	if max <= 0 {
		max = 10000
	}
	if req.VirtualUsers > max {
		return &Violation{
			RuleID: "max-load", RuleName: "Maximum Load",
			Message:  fmt.Sprintf("virtualUsers %d exceeds max %d", req.VirtualUsers, max),
			Severity: "high",
		}
	}
	return nil
}

// ApprovedTargetRule allows only hosts matching approved suffixes.
type ApprovedTargetRule struct {
	// Empty AllowedHosts means any host is allowed (dev default).
	AllowedHosts []string
	BlockedHosts []string
}

func (r ApprovedTargetRule) Evaluate(req ExecutionRequest) *Violation {
	host := extractHost(req.TargetURL)
	for _, b := range r.BlockedHosts {
		if strings.Contains(strings.ToLower(host), strings.ToLower(b)) {
			return &Violation{
				RuleID: "blocked-target", RuleName: "Blocked Target",
				Message:  fmt.Sprintf("target host %q is blocked", host),
				Severity: "critical",
			}
		}
	}
	if len(r.AllowedHosts) == 0 {
		return nil
	}
	for _, a := range r.AllowedHosts {
		if strings.HasSuffix(strings.ToLower(host), strings.ToLower(a)) || strings.EqualFold(host, a) {
			return nil
		}
	}
	return &Violation{
		RuleID: "approved-target", RuleName: "Approved Target",
		Message:  fmt.Sprintf("target host %q is not in the approved list", host),
		Severity: "high",
	}
}

// EnvironmentRestrictionRule limits engines/VUs by environment name.
type EnvironmentRestrictionRule struct {
	Environment string
	MaxVUs      int
	DenyEngines []string
}

func (r EnvironmentRestrictionRule) Evaluate(req ExecutionRequest) *Violation {
	if r.Environment != "" && !strings.EqualFold(req.Environment, r.Environment) {
		return nil
	}
	if r.MaxVUs > 0 && req.VirtualUsers > r.MaxVUs {
		return &Violation{
			RuleID: "env-max-vus", RuleName: "Environment VU Cap",
			Message:  fmt.Sprintf("environment %s max VUs is %d", req.Environment, r.MaxVUs),
			Severity: "high",
		}
	}
	for _, d := range r.DenyEngines {
		if strings.EqualFold(req.Engine, d) {
			return &Violation{
				RuleID: "env-deny-engine", RuleName: "Environment Engine Restriction",
				Message:  fmt.Sprintf("engine %s not allowed in %s", req.Engine, req.Environment),
				Severity: "medium",
			}
		}
	}
	return nil
}

// ImageProvenanceRule requires known engine images (by name allow-list).
type ImageProvenanceRule struct {
	AllowedEngines []string
}

func (r ImageProvenanceRule) Evaluate(req ExecutionRequest) *Violation {
	if len(r.AllowedEngines) == 0 || req.Engine == "" {
		return nil
	}
	for _, a := range r.AllowedEngines {
		if strings.EqualFold(a, req.Engine) || a == "*" {
			return nil
		}
	}
	return &Violation{
		RuleID: "image-provenance", RuleName: "Image Provenance",
		Message:  fmt.Sprintf("engine %q is not an approved image provenance entry", req.Engine),
		Severity: "high",
	}
}

// ApprovalRule requires SERVICE_ACCOUNT or elevated roles for high VU runs.
type ApprovalRule struct {
	VUThreshold int
	AllowedRoles []string
}

func (r ApprovalRule) Evaluate(req ExecutionRequest) *Violation {
	th := r.VUThreshold
	if th <= 0 {
		th = 1000
	}
	if req.VirtualUsers < th {
		return nil
	}
	roles := r.AllowedRoles
	if len(roles) == 0 {
		roles = []string{"PLATFORM_ADMIN", "PERFORMANCE_LEAD", "RELEASE_MANAGER", "SERVICE_ACCOUNT"}
	}
	for _, role := range roles {
		if strings.EqualFold(req.UserRole, role) {
			return nil
		}
	}
	return &Violation{
		RuleID: "approval-required", RuleName: "Approval Required",
		Message:  fmt.Sprintf("runs with >= %d VUs require approval-capable role", th),
		Severity: "high",
	}
}

// DataResidencyRule enforces region tags when residency is set.
type DataResidencyRule struct {
	RequiredRegion string
}

func (r DataResidencyRule) Evaluate(req ExecutionRequest) *Violation {
	if r.RequiredRegion == "" {
		return nil
	}
	// Environment field may carry region code for evaluation
	if req.Environment == "" {
		return &Violation{
			RuleID: "data-residency", RuleName: "Data Residency",
			Message:  "region/environment must be set for residency-controlled runs",
			Severity: "medium",
		}
	}
	return nil
}

// DefaultEnterpriseEngine builds a production-minded rule set for local/dev.
func DefaultEnterpriseEngine(maxVUs int) *PolicyEngine {
	if maxVUs <= 0 {
		maxVUs = 10000
	}
	pe := NewPolicyEngine()
	pe.AddRule(MaxLoadRule{MaxVUs: maxVUs})
	pe.AddRule(ApprovedTargetRule{
		BlockedHosts: []string{"metadata.google.internal", "169.254.169.254"},
	})
	pe.AddRule(EnvironmentRestrictionRule{
		Environment: "production",
		MaxVUs:      2000,
		DenyEngines: []string{},
	})
	pe.AddRule(ImageProvenanceRule{
		AllowedEngines: []string{"simulate", "http", "jmeter", "k6", "gatling", "locust", "playwright", "*"},
	})
	pe.AddRule(ApprovalRule{VUThreshold: 5000})
	pe.AddRule(DataResidencyRule{})
	return pe
}

func extractHost(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		u, err = url.Parse("https://" + raw)
		if err != nil {
			return raw
		}
	}
	return u.Hostname()
}
