package server

import (
	"testing"
	"time"
)

func TestParseTargetURL(t *testing.T) {
	domain, path, protocol := ParseTargetURL("https://api.example.com/v1/login?x=1")
	if protocol != "https" {
		t.Fatalf("protocol=%s", protocol)
	}
	if domain != "api.example.com" {
		t.Fatalf("domain=%s", domain)
	}
	if path != "/v1/login?x=1" {
		t.Fatalf("path=%s", path)
	}
}

func TestSanitizeLabel(t *testing.T) {
	got := sanitizeLabel("Run_ID/ABC 123")
	if got == "" {
		t.Fatal("empty")
	}
	if len(got) > 63 {
		t.Fatalf("too long: %d", len(got))
	}
}

func TestScheduleNextRun(t *testing.T) {
	now := time.Now()
	next := ScheduleNextRun("DAILY", now)
	if !next.After(now) {
		t.Fatalf("expected future, got %v", next)
	}
	hourly := ScheduleNextRun("HOURLY", now)
	if hourly.Sub(now) < time.Hour-time.Second {
		t.Fatalf("hourly too soon: %v", hourly)
	}
}
