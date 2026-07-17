package jira

import (
	"context"
	"testing"
)

func TestJiraDemo(t *testing.T) {
	c := New(Config{DemoMode: true, BaseURL: "https://demo.atlassian.net"})
	issue, err := c.CreateIssue(context.Background(), IssueRequest{
		ProjectKey: "PERF", Summary: "Slow checkout", Description: "p95 high",
	})
	if err != nil || issue.Key == "" {
		t.Fatal(issue, err)
	}
	got, err := c.GetIssue(context.Background(), issue.Key)
	if err != nil || got.Key != issue.Key {
		t.Fatal(got, err)
	}
	sr, err := c.Search(context.Background(), "project = PERF", 10)
	if err != nil || sr.Total < 1 {
		t.Fatal(sr, err)
	}
	def, err := c.CreateDefectFromRun(context.Background(), "PERF", "run-1", "Checkout", 3.2, 900, "https://example/evidence")
	if err != nil || def.Key == "" {
		t.Fatal(def, err)
	}
	st := c.Status()
	if st["demoMode"] != true {
		t.Fatal(st)
	}
}
