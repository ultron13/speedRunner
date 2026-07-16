package scheduler

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Schedule struct {
	ID             string    `json:"id"`
	TestID         string    `json:"test_id"`
	Name           string    `json:"name"`
	Frequency      string    `json:"frequency"`
	CronExpression string    `json:"cron_expression,omitempty"`
	Enabled        bool      `json:"enabled"`
	NextRunAt      *time.Time `json:"next_run_at,omitempty"`
	LastRunAt      *time.Time `json:"last_run_at,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type ExecutionWindow struct {
	Start    time.Time
	End      time.Time
	Blackout bool
}

type Scheduler struct {
	mu        sync.RWMutex
	schedules map[string]*Schedule
	windows   []ExecutionWindow
	onExecute func(testID string) error
}

func New(onExecute func(testID string) error) *Scheduler {
	return &Scheduler{
		schedules: make(map[string]*Schedule),
		onExecute: onExecute,
	}
}

func (s *Scheduler) Create(sched *Schedule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sched.CreatedAt = time.Now()
	sched.Enabled = true
	nextRun := s.calculateNextRun(sched)
	sched.NextRunAt = &nextRun

	s.schedules[sched.ID] = sched
	return nil
}

func (s *Scheduler) Update(id string, sched *Schedule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.schedules[id]
	if !ok {
		return fmt.Errorf("schedule %s not found", id)
	}

	existing.Name = sched.Name
	existing.Frequency = sched.Frequency
	existing.CronExpression = sched.CronExpression
	existing.Enabled = sched.Enabled

	nextRun := s.calculateNextRun(existing)
	existing.NextRunAt = &nextRun

	return nil
}

func (s *Scheduler) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.schedules, id)
	return nil
}

func (s *Scheduler) List() []*Schedule {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var list []*Schedule
	for _, sched := range s.schedules {
		list = append(list, sched)
	}
	return list
}

func (s *Scheduler) AddExecutionWindow(window ExecutionWindow) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.windows = append(s.windows, window)
}

func (s *Scheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkAndExecute()
		}
	}
}

func (s *Scheduler) checkAndExecute() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for _, sched := range s.schedules {
		if !sched.Enabled || sched.NextRunAt == nil {
			continue
		}

		if now.Before(*sched.NextRunAt) {
			continue
		}

		if s.isBlackoutWindow(now) {
			fmt.Printf("[scheduler] skipping %s - blackout window\n", sched.ID)
			continue
		}

		fmt.Printf("[scheduler] executing schedule %s for test %s\n", sched.ID, sched.TestID)
		if s.onExecute != nil {
			if err := s.onExecute(sched.TestID); err != nil {
				fmt.Printf("[scheduler] execution failed for %s: %v\n", sched.ID, err)
			}
		}

		sched.LastRunAt = &now
		nextRun := s.calculateNextRun(sched)
		sched.NextRunAt = &nextRun
	}
}

func (s *Scheduler) isBlackoutWindow(now time.Time) bool {
	for _, w := range s.windows {
		if w.Blackout && now.After(w.Start) && now.Before(w.End) {
			return true
		}
	}
	return false
}

func (s *Scheduler) calculateNextRun(sched *Schedule) time.Time {
	now := time.Now()
	switch sched.Frequency {
	case "ONCE":
		return now.Add(24 * time.Hour)
	case "DAILY":
		return now.Add(24 * time.Hour)
	case "WEEKLY":
		return now.Add(7 * 24 * time.Hour)
	case "MONTHLY":
		return now.Add(30 * 24 * time.Hour)
	default:
		return now.Add(24 * time.Hour)
	}
}
