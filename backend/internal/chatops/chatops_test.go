package chatops

import (
	"context"
	"testing"
)

type mockExec struct{}

func (m mockExec) StartTest(ctx context.Context, testID, user string) (string, error) {
	return "run-abc", nil
}
func (m mockExec) StopRun(ctx context.Context, runID, user string) error { return nil }
func (m mockExec) GetStatus(ctx context.Context, runID string) (string, error) {
	return "RUNNING", nil
}

func TestParseAndHandle(t *testing.T) {
	svc := New(mockExec{})
	cmd, err := ParseCommand(ChannelSlack, "alice", "/sr start test-1")
	if err != nil {
		t.Fatal(err)
	}
	reply, err := svc.Handle(context.Background(), cmd)
	if err != nil {
		t.Fatal(err)
	}
	if reply == "" {
		t.Fatal("empty reply")
	}
	cmd2, _ := ParseCommand(ChannelSlack, "alice", "/sr help")
	reply2, err := svc.Handle(context.Background(), cmd2)
	if err != nil || reply2 == "" {
		t.Fatalf("help failed: %v %s", err, reply2)
	}
}
