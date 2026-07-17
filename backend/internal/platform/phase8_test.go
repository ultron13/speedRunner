package platform

import (
	"testing"
	"time"
)

func TestOutboxWebhook(t *testing.T) {
	o := NewOutbox()
	ev := o.Enqueue("e1", "run.completed", map[string]interface{}{"runId": "r1"})
	if ev.ID != "e1" {
		t.Fatal(ev)
	}
	if len(o.Pending()) != 1 {
		t.Fatal("pending")
	}
	o.MarkRetry("e1")
	// next attempt is in future after retry
	o.MarkDelivered("e1")
	if len(o.Pending()) != 0 {
		t.Fatal("delivered")
	}
	sig := SignWebhook("secret", `{"a":1}`)
	if !VerifyWebhook("secret", `{"a":1}`, sig) {
		t.Fatal("verify")
	}
	if VerifyWebhook("wrong", `{"a":1}`, sig) {
		t.Fatal("should fail")
	}
}

func TestIdempotencySoftDelete(t *testing.T) {
	id := NewIdempotencyStore(time.Hour)
	if !id.First("k1") {
		t.Fatal("first")
	}
	if id.First("k1") {
		t.Fatal("dup")
	}
	sd := NewSoftDeleter()
	sd.Delete("x")
	if !sd.IsDeleted("x") {
		t.Fatal("deleted")
	}
	sd.Restore("x")
	if sd.IsDeleted("x") {
		t.Fatal("restored")
	}
}

func TestAlertsSLOCircuitWatchdog(t *testing.T) {
	fired, _ := EvaluateAlert(AlertRule{Metric: "error_rate", Operator: "gt", Threshold: 1, Enabled: true, Severity: "high"}, 5)
	if !fired {
		t.Fatal("alert")
	}
	st := SLOStatus(SLO{Name: "avail", Target: 0.999, BurnedFraction: 0.8})
	if st["status"] != "critical" {
		t.Fatal(st)
	}
	cb := NewCircuitBreaker(2, time.Millisecond)
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.Allow() {
		t.Fatal("should be open")
	}
	time.Sleep(2 * time.Millisecond)
	if !cb.Allow() {
		// half-open after cooldown
	}
	cb.RecordSuccess()
	if cb.State() != CircuitClosed {
		t.Fatal(cb.State())
	}
	stop, reason := WatchdogShouldStop(400, 300, 1, 5)
	if !stop || reason == "" {
		t.Fatal("watchdog duration")
	}
	stop, _ = WatchdogShouldStop(10, 300, 10, 5)
	if !stop {
		t.Fatal("watchdog errors")
	}
}

func TestQueueRampBudgetPrefs(t *testing.T) {
	q := NewFairQueue()
	q.Enqueue(QueuedRun{ID: "1", Team: "a", Priority: 1, VUs: 10})
	q.Enqueue(QueuedRun{ID: "2", Team: "b", Priority: 5, VUs: 20})
	item, ok := q.Dequeue()
	if !ok || item.ID != "2" {
		t.Fatalf("%+v", item)
	}
	ramp := BuildProgressiveRamp(100, 100, 5)
	if len(ramp) != 5 || ramp[4].VUs != 100 {
		t.Fatal(ramp)
	}
	if VUsAt(50, ramp) <= 0 {
		t.Fatal("vus at")
	}
	bs := BudgetStatus(Budget{Team: "t", LimitUSD: 100, SpentUSD: 90, AlertAt: 0.8})
	if bs["status"] != "alert" {
		t.Fatal(bs)
	}
	prefs := NewUserPrefsStore()
	prefs.SaveSearch(&SavedSearch{ID: "s1", Name: "failed", UserID: "u1", Filters: map[string]string{"status": "failed"}})
	prefs.AddBookmark(&Bookmark{ID: "b1", UserID: "u1", Type: "test", RefID: "t1"})
	if len(prefs.ListSearches("u1")) != 1 || len(prefs.ListBookmarks("u1")) != 1 {
		t.Fatal("prefs")
	}
}

func TestComplianceOrgPhase8Catalog(t *testing.T) {
	c := ClassifyData("user email test@example.com password=x")
	if c["classification"] == "public" {
		t.Fatal(c)
	}
	pack := ComplianceEvidencePack([]string{"r1"}, 10)
	if pack["framework"] == nil {
		t.Fatal(pack)
	}
	org := NewOrgStore()
	if len(org.ListUnits()) < 2 {
		t.Fatal("units")
	}
	org.Invite(&Invite{ID: "i1", Email: "a@b.com", Role: "QA", OrgUnitID: "team-perf"})
	if len(org.ListInvites()) != 1 {
		t.Fatal("invites")
	}
	if len(Phase8Catalog()) != 50 {
		t.Fatalf("want 50 got %d", len(Phase8Catalog()))
	}
}
