package scheduler

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// CronParser parses cron expressions and calculates next run times
type CronParser struct{}

// NewCronParser creates a new cron parser
func NewCronParser() *CronParser {
	return &CronParser{}
}

// Parse parses a cron expression (minute hour day month weekday)
func (p *CronParser) Parse(expr string) (*CronExpression, error) {
	parts := strings.Fields(expr)
	if len(parts) != 5 {
		return nil, fmt.Errorf("invalid cron expression: expected 5 fields, got %d", len(parts))
	}

	minute, err := parseCronField(parts[0], 0, 59)
	if err != nil {
		return nil, fmt.Errorf("invalid minute field: %w", err)
	}

	hour, err := parseCronField(parts[1], 0, 23)
	if err != nil {
		return nil, fmt.Errorf("invalid hour field: %w", err)
	}

	dayOfMonth, err := parseCronField(parts[2], 1, 31)
	if err != nil {
		return nil, fmt.Errorf("invalid day of month field: %w", err)
	}

	month, err := parseCronField(parts[3], 1, 12)
	if err != nil {
		return nil, fmt.Errorf("invalid month field: %w", err)
	}

	dayOfWeek, err := parseCronField(parts[4], 0, 6)
	if err != nil {
		return nil, fmt.Errorf("invalid day of week field: %w", err)
	}

	return &CronExpression{
		Minute:     minute,
		Hour:       hour,
		DayOfMonth: dayOfMonth,
		Month:      month,
		DayOfWeek:  dayOfWeek,
		Raw:        expr,
	}, nil
}

// NextRun calculates the next run time after the given time
func (p *CronParser) NextRun(expr *CronExpression, after time.Time) time.Time {
	next := after.Add(time.Minute)
	next = next.Truncate(time.Minute)

	for i := 0; i < 365*24*60; i++ { // Max 1 year ahead
		if matchesCron(expr, next) {
			return next
		}
		next = next.Add(time.Minute)
	}

	return after // Fallback
}

// CronExpression represents a parsed cron expression
type CronExpression struct {
	Minute     []int
	Hour       []int
	DayOfMonth []int
	Month      []int
	DayOfWeek  []int
	Raw        string
}

func parseCronField(field string, min, max int) ([]int, error) {
	var values []int

	if field == "*" {
		for i := min; i <= max; i++ {
			values = append(values, i)
		}
		return values, nil
	}

	// Handle comma-separated values
	parts := strings.Split(field, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)

		// Handle range (e.g., 1-5)
		if strings.Contains(part, "-") {
			rangeParts := strings.Split(part, "-")
			if len(rangeParts) != 2 {
				return nil, fmt.Errorf("invalid range: %s", part)
			}
			start, err := strconv.Atoi(rangeParts[0])
			if err != nil {
				return nil, err
			}
			end, err := strconv.Atoi(rangeParts[1])
			if err != nil {
				return nil, err
			}
			for i := start; i <= end; i++ {
				values = append(values, i)
			}
		} else if strings.Contains(part, "/") {
			// Handle step (e.g., */5)
			stepParts := strings.Split(part, "/")
			if len(stepParts) != 2 {
				return nil, fmt.Errorf("invalid step: %s", part)
			}
			step, err := strconv.Atoi(stepParts[1])
			if err != nil {
				return nil, err
			}
			for i := min; i <= max; i += step {
				values = append(values, i)
			}
		} else {
			val, err := strconv.Atoi(part)
			if err != nil {
				return nil, err
			}
			values = append(values, val)
		}
	}

	return values, nil
}

func matchesCron(expr *CronExpression, t time.Time) bool {
	if !contains(expr.Minute, t.Minute()) {
		return false
	}
	if !contains(expr.Hour, t.Hour()) {
		return false
	}
	if !contains(expr.DayOfMonth, t.Day()) {
		return false
	}
	if !contains(expr.Month, int(t.Month())) {
		return false
	}
	if !contains(expr.DayOfWeek, int(t.Weekday())) {
		return false
	}
	return true
}

func contains(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}
