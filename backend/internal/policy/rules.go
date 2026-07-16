package policy

import (
	"fmt"
	"net/url"
	"strings"
)

// MaxVirtualUsersRule limits the maximum number of virtual users
type MaxVirtualUsersRule struct {
	ID       string
	Name     string
	MaxVUs   int
	Enabled  bool
}

func (r *MaxVirtualUsersRule) Evaluate(req ExecutionRequest) *Violation {
	if req.VirtualUsers > r.MaxVUs {
		return &Violation{
			RuleID:   r.ID,
			RuleName: r.Name,
			Message:  fmt.Sprintf("Virtual users (%d) exceeds maximum allowed (%d)", req.VirtualUsers, r.MaxVUs),
			Severity: "high",
		}
	}
	return nil
}

// MaxDurationRule limits the maximum test duration
type MaxDurationRule struct {
	ID          string
	Name        string
	MaxDuration int // in seconds
	Enabled     bool
}

func (r *MaxDurationRule) Evaluate(req ExecutionRequest) *Violation {
	if req.Duration > r.MaxDuration {
		return &Violation{
			RuleID:   r.ID,
			RuleName: r.Name,
			Message:  fmt.Sprintf("Duration (%ds) exceeds maximum allowed (%ds)", req.Duration, r.MaxDuration),
			Severity: "medium",
		}
	}
	return nil
}

// ApprovedTargetRule restricts which URLs can be tested
type ApprovedTargetRule struct {
	ID              string
	Name            string
	ApprovedDomains []string
	Enabled         bool
}

func (r *ApprovedTargetRule) Evaluate(req ExecutionRequest) *Violation {
	if len(r.ApprovedDomains) == 0 {
		return nil
	}

	parsed, err := url.Parse(req.TargetURL)
	if err != nil {
		return &Violation{
			RuleID:   r.ID,
			RuleName: r.Name,
			Message:  fmt.Sprintf("Invalid target URL: %s", req.TargetURL),
			Severity: "high",
		}
	}

	host := parsed.Hostname()
	for _, approved := range r.ApprovedDomains {
		if strings.HasSuffix(host, approved) || host == approved {
			return nil
		}
	}

	return &Violation{
		RuleID:   r.ID,
		RuleName: r.Name,
		Message:  fmt.Sprintf("Target domain %s is not in approved list", host),
		Severity: "high",
	}
}

// EnvironmentRestrictionRule restricts which environments can be tested
type EnvironmentRestrictionRule struct {
	ID                string
	Name              string
	RestrictedEnvs    []string
	UserRoleThreshold string // Minimum role required for restricted envs
	Enabled           bool
}

func (r *EnvironmentRestrictionRule) Evaluate(req ExecutionRequest) *Violation {
	if len(r.RestrictedEnvs) == 0 {
		return nil
	}

	for _, env := range r.RestrictedEnvs {
		if req.Environment == env {
			// Check if user has required role
			if !hasMinRole(req.UserRole, r.UserRoleThreshold) {
				return &Violation{
					RuleID:   r.ID,
					RuleName: r.Name,
					Message:  fmt.Sprintf("Environment %s requires %s role or higher", env, r.UserRoleThreshold),
					Severity: "high",
				}
			}
		}
	}

	return nil
}

// Role hierarchy for permission checks
var roleHierarchy = map[string]int{
	"READ_ONLY":              1,
	"DEVELOPER":              2,
	"QA":                     3,
	"PERFORMANCE_ENGINEER":   4,
	"RELEASE_MANAGER":        5,
	"PERFORMANCE_LEAD":       6,
	"PLATFORM_ADMIN":         7,
}

func hasMinRole(userRole, requiredRole string) bool {
	userLevel, ok := roleHierarchy[userRole]
	if !ok {
		return false
	}
	requiredLevel, ok := roleHierarchy[requiredRole]
	if !ok {
		return false
	}
	return userLevel >= requiredLevel
}
