package chatops

import (
	"context"
	"fmt"
	"strings"
	"sync"
)

// Channel identifies a ChatOps destination.
type Channel string

const (
	ChannelSlack Channel = "slack"
	ChannelTeams Channel = "teams"
)

// Command is a parsed ChatOps command.
type Command struct {
	Channel   Channel
	User      string
	Text      string
	Action    string // start | status | stop | help
	TestID    string
	RunID     string
	RawArgs   []string
}

// Notification is an outbound status message.
type Notification struct {
	Channel Channel
	Title   string
	Body    string
	Level   string // info | success | warning | error
	RunID   string
	TestID  string
}

// Executor performs platform actions on behalf of ChatOps commands.
type Executor interface {
	StartTest(ctx context.Context, testID, user string) (runID string, err error)
	StopRun(ctx context.Context, runID, user string) error
	GetStatus(ctx context.Context, runID string) (string, error)
}

// Service parses commands and dispatches notifications (in-memory for Phase 1).
type Service struct {
	mu            sync.Mutex
	executor      Executor
	notifications []Notification
}

func New(executor Executor) *Service {
	return &Service{executor: executor}
}

// ParseCommand understands simple slash-style commands:
//   /sr start <testId>
//   /sr stop <runId>
//   /sr status <runId>
//   /sr help
func ParseCommand(channel Channel, user, text string) (*Command, error) {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "/sr ")
	text = strings.TrimPrefix(text, "/speedrunner ")
	parts := strings.Fields(text)
	if len(parts) == 0 {
		return nil, fmt.Errorf("empty command")
	}
	cmd := &Command{
		Channel: channel,
		User:    user,
		Text:    text,
		Action:  strings.ToLower(parts[0]),
		RawArgs: parts[1:],
	}
	switch cmd.Action {
	case "start":
		if len(parts) < 2 {
			return nil, fmt.Errorf("usage: start <testId>")
		}
		cmd.TestID = parts[1]
	case "stop", "status":
		if len(parts) < 2 {
			return nil, fmt.Errorf("usage: %s <runId>", cmd.Action)
		}
		cmd.RunID = parts[1]
	case "help":
		// no args
	default:
		return nil, fmt.Errorf("unknown action %q — try help", cmd.Action)
	}
	return cmd, nil
}

// Handle executes a command and returns a user-facing reply.
func (s *Service) Handle(ctx context.Context, cmd *Command) (string, error) {
	if cmd == nil {
		return "", fmt.Errorf("nil command")
	}
	switch cmd.Action {
	case "help":
		return "SpeedRunner ChatOps: start <testId> | stop <runId> | status <runId> | help", nil
	case "start":
		if s.executor == nil {
			return "", fmt.Errorf("executor not configured")
		}
		runID, err := s.executor.StartTest(ctx, cmd.TestID, cmd.User)
		if err != nil {
			return "", err
		}
		s.notify(Notification{
			Channel: cmd.Channel,
			Title:   "Run started",
			Body:    fmt.Sprintf("Test %s started as run %s by %s", cmd.TestID, runID, cmd.User),
			Level:   "success",
			RunID:   runID,
			TestID:  cmd.TestID,
		})
		return fmt.Sprintf("Started run %s for test %s", runID, cmd.TestID), nil
	case "stop":
		if s.executor == nil {
			return "", fmt.Errorf("executor not configured")
		}
		if err := s.executor.StopRun(ctx, cmd.RunID, cmd.User); err != nil {
			return "", err
		}
		s.notify(Notification{
			Channel: cmd.Channel,
			Title:   "Run stopped",
			Body:    fmt.Sprintf("Run %s stopped by %s", cmd.RunID, cmd.User),
			Level:   "warning",
			RunID:   cmd.RunID,
		})
		return fmt.Sprintf("Stopped run %s", cmd.RunID), nil
	case "status":
		if s.executor == nil {
			return "", fmt.Errorf("executor not configured")
		}
		st, err := s.executor.GetStatus(ctx, cmd.RunID)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Run %s status: %s", cmd.RunID, st), nil
	default:
		return "", fmt.Errorf("unknown action")
	}
}

func (s *Service) notify(n Notification) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notifications = append(s.notifications, n)
	if len(s.notifications) > 100 {
		s.notifications = s.notifications[len(s.notifications)-100:]
	}
}

// RecentNotifications returns the last N notifications (for debugging / UI).
func (s *Service) RecentNotifications(limit int) []Notification {
	s.mu.Lock()
	defer s.mu.Unlock()
	if limit <= 0 || limit > len(s.notifications) {
		limit = len(s.notifications)
	}
	start := len(s.notifications) - limit
	out := make([]Notification, limit)
	copy(out, s.notifications[start:])
	return out
}
