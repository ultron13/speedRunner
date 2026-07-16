package cicd

import (
	"fmt"
	"sync"
	"time"
)

// TriggerType describes how a CI/CD pipeline invoked a test.
type TriggerType string

const (
	TriggerJenkins  TriggerType = "JENKINS"
	TriggerGitHub   TriggerType = "GITHUB_ACTIONS"
	TriggerGitLab   TriggerType = "GITLAB_CI"
	TriggerGeneric  TriggerType = "WEBHOOK"
	TriggerManual   TriggerType = "MANUAL"
)

// PipelineEvent records a CI/CD-triggered run request.
type PipelineEvent struct {
	ID          string      `json:"id"`
	Source      TriggerType `json:"source"`
	PipelineID  string      `json:"pipelineId"`
	BuildNumber string      `json:"buildNumber,omitempty"`
	CommitSHA   string      `json:"commitSha,omitempty"`
	Branch      string      `json:"branch,omitempty"`
	TestID      string      `json:"testId"`
	RunID       string      `json:"runId,omitempty"`
	Status      string      `json:"status"`
	CreatedAt   time.Time   `json:"createdAt"`
	CallbackURL string      `json:"callbackUrl,omitempty"`
}

// GateResult is returned to CI to pass/fail a release gate.
type GateResult struct {
	Passed   bool    `json:"passed"`
	RunID    string  `json:"runId"`
	Summary  string  `json:"summary"`
	ErrorRate float64 `json:"errorRate,omitempty"`
	AvgRT    float64 `json:"avgResponseTime,omitempty"`
	SLAFail  int     `json:"slaFailures,omitempty"`
}

// Service tracks CI/CD integrations (in-memory registry for Phase 1–3).
type Service struct {
	mu     sync.RWMutex
	events map[string]*PipelineEvent
}

func New() *Service {
	return &Service{events: make(map[string]*PipelineEvent)}
}

func (s *Service) Record(ev *PipelineEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ev.CreatedAt.IsZero() {
		ev.CreatedAt = time.Now().UTC()
	}
	if ev.Status == "" {
		ev.Status = "RECEIVED"
	}
	s.events[ev.ID] = ev
}

func (s *Service) AttachRun(eventID, runID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ev, ok := s.events[eventID]
	if !ok {
		return fmt.Errorf("pipeline event %s not found", eventID)
	}
	ev.RunID = runID
	ev.Status = "RUNNING"
	return nil
}

func (s *Service) Complete(eventID string, result GateResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ev, ok := s.events[eventID]
	if !ok {
		return fmt.Errorf("pipeline event %s not found", eventID)
	}
	if result.Passed {
		ev.Status = "PASSED"
	} else {
		ev.Status = "FAILED"
	}
	return nil
}

func (s *Service) Get(id string) (*PipelineEvent, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ev, ok := s.events[id]
	return ev, ok
}

func (s *Service) List(limit int) []*PipelineEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*PipelineEvent, 0, len(s.events))
	for _, ev := range s.events {
		out = append(out, ev)
	}
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

// ParseTrigger maps common CI header / body source strings to TriggerType.
func ParseTrigger(source string) TriggerType {
	switch source {
	case "jenkins", "JENKINS":
		return TriggerJenkins
	case "github", "github_actions", "GITHUB_ACTIONS":
		return TriggerGitHub
	case "gitlab", "gitlab_ci", "GITLAB_CI":
		return TriggerGitLab
	case "manual", "MANUAL":
		return TriggerManual
	default:
		return TriggerGeneric
	}
}
