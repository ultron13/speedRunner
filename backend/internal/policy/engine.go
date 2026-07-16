package policy

import (
	"context"
	"time"
)

// PolicyEngine evaluates execution policies
type PolicyEngine struct {
	rules []Rule
}

func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{
		rules: make([]Rule, 0),
	}
}

// AddRule adds a policy rule
func (pe *PolicyEngine) AddRule(rule Rule) {
	pe.rules = append(pe.rules, rule)
}

// Evaluate evaluates all rules against an execution request
func (pe *PolicyEngine) Evaluate(ctx context.Context, req ExecutionRequest) (*PolicyResult, error) {
	result := &PolicyResult{
		Allowed:     true,
		Violations:  make([]Violation, 0),
		EvaluatedAt: time.Now().UTC(),
	}

	for _, rule := range pe.rules {
		violation := rule.Evaluate(req)
		if violation != nil {
			result.Allowed = false
			result.Violations = append(result.Violations, *violation)
		}
	}

	return result, nil
}

// PolicyResult contains the result of policy evaluation
type PolicyResult struct {
	Allowed     bool        `json:"allowed"`
	Violations  []Violation `json:"violations"`
	EvaluatedAt time.Time   `json:"evaluated_at"`
}

// Violation represents a policy violation
type Violation struct {
	RuleID   string `json:"rule_id"`
	RuleName string `json:"rule_name"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

// ExecutionRequest represents a test execution request to evaluate
type ExecutionRequest struct {
	RunID        string
	TestID       string
	TargetURL    string
	VirtualUsers int
	Duration     int
	Engine       string
	Environment  string
	UserID       string
	UserRole     string
}

// Rule defines a policy rule
type Rule interface {
	Evaluate(req ExecutionRequest) *Violation
}
