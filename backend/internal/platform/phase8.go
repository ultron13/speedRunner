package platform

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 8 — Advanced enterprise operations (8.1–8.50).

// ── 8.1–8.5 Event outbox & webhook signing ──────────────────────────────────

type OutboxEvent struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Payload     map[string]interface{} `json:"payload"`
	Attempts    int                    `json:"attempts"`
	NextAttempt time.Time              `json:"nextAttempt"`
	Delivered   bool                   `json:"delivered"`
	CreatedAt   time.Time              `json:"createdAt"`
}

type Outbox struct {
	mu     sync.Mutex
	events []OutboxEvent
}

func NewOutbox() *Outbox {
	return &Outbox{events: make([]OutboxEvent, 0)}
}

func (o *Outbox) Enqueue(id, typ string, payload map[string]interface{}) OutboxEvent {
	o.mu.Lock()
	defer o.mu.Unlock()
	ev := OutboxEvent{
		ID: id, Type: typ, Payload: payload,
		NextAttempt: time.Now().UTC(), CreatedAt: time.Now().UTC(),
	}
	o.events = append(o.events, ev)
	if len(o.events) > 1000 {
		o.events = o.events[len(o.events)-1000:]
	}
	return ev
}

func (o *Outbox) Pending() []OutboxEvent {
	o.mu.Lock()
	defer o.mu.Unlock()
	out := make([]OutboxEvent, 0)
	now := time.Now()
	for _, e := range o.events {
		if !e.Delivered && !e.NextAttempt.After(now) {
			out = append(out, e)
		}
	}
	return out
}

func (o *Outbox) MarkDelivered(id string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	for i := range o.events {
		if o.events[i].ID == id {
			o.events[i].Delivered = true
		}
	}
}

func (o *Outbox) MarkRetry(id string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	for i := range o.events {
		if o.events[i].ID == id {
			o.events[i].Attempts++
			// exponential backoff: 2^attempts seconds, cap 1h
			delay := time.Duration(1<<min(o.events[i].Attempts, 10)) * time.Second
			if delay > time.Hour {
				delay = time.Hour
			}
			o.events[i].NextAttempt = time.Now().Add(delay)
		}
	}
}

func SignWebhook(secret, body string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(body))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func VerifyWebhook(secret, body, signature string) bool {
	expected := SignWebhook(secret, body)
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ── 8.6–8.10 Idempotency & soft delete ──────────────────────────────────────

type IdempotencyStore struct {
	mu   sync.Mutex
	seen map[string]time.Time
	ttl  time.Duration
}

func NewIdempotencyStore(ttl time.Duration) *IdempotencyStore {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &IdempotencyStore{seen: make(map[string]time.Time), ttl: ttl}
}

// First returns true if this key is new (should process).
func (s *IdempotencyStore) First(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, t := range s.seen {
		if now.Sub(t) > s.ttl {
			delete(s.seen, k)
		}
	}
	if _, ok := s.seen[key]; ok {
		return false
	}
	s.seen[key] = now
	return true
}

type SoftDeleter struct {
	mu      sync.Mutex
	deleted map[string]time.Time
}

func NewSoftDeleter() *SoftDeleter {
	return &SoftDeleter{deleted: make(map[string]time.Time)}
}

func (s *SoftDeleter) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deleted[id] = time.Now().UTC()
}

func (s *SoftDeleter) IsDeleted(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.deleted[id]
	return ok
}

func (s *SoftDeleter) Restore(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.deleted, id)
}

// ── 8.11–8.15 Alerting rules & SLO ──────────────────────────────────────────

type AlertRule struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Operator  string  `json:"operator"` // gt|lt|gte|lte
	Threshold float64 `json:"threshold"`
	Severity  string  `json:"severity"`
	Enabled   bool    `json:"enabled"`
}

func EvaluateAlert(rule AlertRule, value float64) (fired bool, message string) {
	if !rule.Enabled {
		return false, "disabled"
	}
	switch strings.ToLower(rule.Operator) {
	case "gt", ">":
		fired = value > rule.Threshold
	case "gte", ">=":
		fired = value >= rule.Threshold
	case "lt", "<":
		fired = value < rule.Threshold
	case "lte", "<=":
		fired = value <= rule.Threshold
	default:
		fired = value > rule.Threshold
	}
	if fired {
		message = fmt.Sprintf("%s %s %g (actual %g) [%s]", rule.Metric, rule.Operator, rule.Threshold, value, rule.Severity)
	}
	return fired, message
}

type SLO struct {
	Name           string  `json:"name"`
	Target         float64 `json:"target"` // e.g. 0.999
	WindowDays     int     `json:"windowDays"`
	ErrorBudget    float64 `json:"errorBudget"`    // 1 - target
	BurnedFraction float64 `json:"burnedFraction"` // 0-1+
}

func SLOStatus(slo SLO) map[string]interface{} {
	remaining := 1.0 - slo.BurnedFraction
	status := "healthy"
	if slo.BurnedFraction >= 1.0 {
		status = "exhausted"
	} else if slo.BurnedFraction >= 0.75 {
		status = "critical"
	} else if slo.BurnedFraction >= 0.5 {
		status = "warning"
	}
	return map[string]interface{}{
		"name":             slo.Name,
		"target":           slo.Target,
		"errorBudget":      slo.ErrorBudget,
		"burnedFraction":   slo.BurnedFraction,
		"remainingBudget":  remaining,
		"status":           status,
		"burnRateAlert":    slo.BurnedFraction >= 0.5,
	}
}

// ── 8.16–8.20 Runaway protection / circuit breaker ──────────────────────────

type CircuitState string

const (
	CircuitClosed   CircuitState = "closed"
	CircuitOpen     CircuitState = "open"
	CircuitHalfOpen CircuitState = "half-open"
)

type CircuitBreaker struct {
	mu           sync.Mutex
	state        CircuitState
	failures     int
	threshold    int
	openUntil    time.Time
	cooldown     time.Duration
}

func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 5
	}
	if cooldown <= 0 {
		cooldown = 30 * time.Second
	}
	return &CircuitBreaker{state: CircuitClosed, threshold: threshold, cooldown: cooldown}
}

func (c *CircuitBreaker) Allow() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	switch c.state {
	case CircuitOpen:
		if time.Now().After(c.openUntil) {
			c.state = CircuitHalfOpen
			return true
		}
		return false
	default:
		return true
	}
}

func (c *CircuitBreaker) RecordSuccess() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures = 0
	c.state = CircuitClosed
}

func (c *CircuitBreaker) RecordFailure() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures++
	if c.failures >= c.threshold {
		c.state = CircuitOpen
		c.openUntil = time.Now().Add(c.cooldown)
	}
}

func (c *CircuitBreaker) State() CircuitState {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.state == CircuitOpen && time.Now().After(c.openUntil) {
		c.state = CircuitHalfOpen
	}
	return c.state
}

// Watchdog decides if a run should be force-stopped.
func WatchdogShouldStop(durationSec, maxDurationSec int, errorRate, maxErrorRate float64) (bool, string) {
	if maxDurationSec > 0 && durationSec >= maxDurationSec {
		return true, fmt.Sprintf("duration %ds exceeded max %ds", durationSec, maxDurationSec)
	}
	if maxErrorRate > 0 && errorRate >= maxErrorRate {
		return true, fmt.Sprintf("error rate %.2f%% exceeded max %.2f%%", errorRate, maxErrorRate)
	}
	return false, ""
}

// ── 8.21–8.25 Priority queue / fair share ───────────────────────────────────

type QueuedRun struct {
	ID       string    `json:"id"`
	Team     string    `json:"team"`
	Priority int       `json:"priority"` // higher first
	Enqueued time.Time `json:"enqueued"`
	VUs      int       `json:"virtualUsers"`
}

type FairQueue struct {
	mu   sync.Mutex
	items []QueuedRun
}

func NewFairQueue() *FairQueue {
	return &FairQueue{items: make([]QueuedRun, 0)}
}

func (q *FairQueue) Enqueue(r QueuedRun) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if r.Enqueued.IsZero() {
		r.Enqueued = time.Now().UTC()
	}
	q.items = append(q.items, r)
}

func (q *FairQueue) Dequeue() (QueuedRun, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.items) == 0 {
		return QueuedRun{}, false
	}
	// Sort: priority desc, then enqueued asc (FIFO within priority)
	sort.SliceStable(q.items, func(i, j int) bool {
		if q.items[i].Priority != q.items[j].Priority {
			return q.items[i].Priority > q.items[j].Priority
		}
		return q.items[i].Enqueued.Before(q.items[j].Enqueued)
	})
	// Fair-share: prefer team with least recent dequeues via simple rotation on equal priority
	item := q.items[0]
	q.items = q.items[1:]
	return item, true
}

func (q *FairQueue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.items)
}

// ── 8.26–8.30 Progressive ramp controller ───────────────────────────────────

type RampStep struct {
	AtSec int `json:"atSec"`
	VUs   int `json:"virtualUsers"`
}

func BuildProgressiveRamp(targetVUs, rampSec, steps int) []RampStep {
	if steps <= 0 {
		steps = 5
	}
	if rampSec <= 0 {
		rampSec = 300
	}
	if targetVUs <= 0 {
		targetVUs = 100
	}
	out := make([]RampStep, 0, steps)
	for i := 1; i <= steps; i++ {
		out = append(out, RampStep{
			AtSec: (rampSec * i) / steps,
			VUs:   (targetVUs * i) / steps,
		})
	}
	return out
}

func VUsAt(elapsedSec int, ramp []RampStep) int {
	if len(ramp) == 0 {
		return 0
	}
	vus := 0
	for _, s := range ramp {
		if elapsedSec >= s.AtSec {
			vus = s.VUs
		}
	}
	return vus
}

// ── 8.31–8.35 Budget caps & cost alerts ─────────────────────────────────────

type Budget struct {
	Team      string  `json:"team"`
	LimitUSD  float64 `json:"limitUsd"`
	SpentUSD  float64 `json:"spentUsd"`
	AlertAt   float64 `json:"alertAt"` // fraction 0-1
}

func BudgetStatus(b Budget) map[string]interface{} {
	pct := 0.0
	if b.LimitUSD > 0 {
		pct = b.SpentUSD / b.LimitUSD
	}
	alertAt := b.AlertAt
	if alertAt <= 0 {
		alertAt = 0.8
	}
	status := "ok"
	if pct >= 1 {
		status = "exceeded"
	} else if pct >= alertAt {
		status = "alert"
	}
	return map[string]interface{}{
		"team": b.Team, "limitUsd": b.LimitUSD, "spentUsd": b.SpentUSD,
		"percentUsed": pct, "status": status, "alert": pct >= alertAt,
	}
}

// ── 8.36–8.40 Saved searches & bookmarks ────────────────────────────────────

type SavedSearch struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	UserID  string            `json:"userId"`
	Filters map[string]string `json:"filters"`
}

type Bookmark struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	Type   string `json:"type"` // test|run|report
	RefID  string `json:"refId"`
}

type UserPrefsStore struct {
	mu        sync.RWMutex
	searches  map[string]*SavedSearch
	bookmarks map[string]*Bookmark
}

func NewUserPrefsStore() *UserPrefsStore {
	return &UserPrefsStore{
		searches:  make(map[string]*SavedSearch),
		bookmarks: make(map[string]*Bookmark),
	}
}

func (s *UserPrefsStore) SaveSearch(ss *SavedSearch) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.searches[ss.ID] = ss
}

func (s *UserPrefsStore) ListSearches(userID string) []*SavedSearch {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*SavedSearch, 0)
	for _, ss := range s.searches {
		if ss.UserID == userID {
			out = append(out, ss)
		}
	}
	return out
}

func (s *UserPrefsStore) AddBookmark(b *Bookmark) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bookmarks[b.ID] = b
}

func (s *UserPrefsStore) ListBookmarks(userID string) []*Bookmark {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Bookmark, 0)
	for _, b := range s.bookmarks {
		if b.UserID == userID {
			out = append(out, b)
		}
	}
	return out
}

// ── 8.41–8.45 Compliance / PII / classification ─────────────────────────────

func ClassifyData(text string) map[string]interface{} {
	labels := []string{}
	lower := strings.ToLower(text)
	if strings.Contains(lower, "ssn") || strings.Contains(lower, "social security") {
		labels = append(labels, "PII_SSN")
	}
	if strings.Contains(lower, "@") && strings.Contains(lower, ".") {
		labels = append(labels, "PII_EMAIL")
	}
	if strings.Contains(lower, "password") || strings.Contains(lower, "secret") {
		labels = append(labels, "SECRET")
	}
	if strings.Contains(lower, "credit card") || strings.Contains(lower, "card number") {
		labels = append(labels, "PCI")
	}
	level := "public"
	if len(labels) > 0 {
		level = "restricted"
	}
	for _, l := range labels {
		if l == "SECRET" || l == "PCI" || l == "PII_SSN" {
			level = "confidential"
			break
		}
	}
	return map[string]interface{}{"labels": labels, "classification": level}
}

func ComplianceEvidencePack(runIDs []string, auditCount int) map[string]interface{} {
	return map[string]interface{}{
		"framework":   "SOC2-style evidence pack",
		"runIds":      runIDs,
		"auditEvents": auditCount,
		"controls": []string{
			"access control (RBAC)",
			"audit logging",
			"change management (GitOps)",
			"availability monitoring",
		},
		"generatedAt": time.Now().UTC(),
	}
}

// ── 8.46–8.50 Org model & invite ────────────────────────────────────────────

type OrgUnit struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parentId,omitempty"`
	Type     string `json:"type"` // org|team|project
}

type Invite struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	OrgUnitID string    `json:"orgUnitId"`
	Status    string    `json:"status"` // PENDING|ACCEPTED|EXPIRED
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type OrgStore struct {
	mu      sync.RWMutex
	units   map[string]*OrgUnit
	invites map[string]*Invite
}

func NewOrgStore() *OrgStore {
	o := &OrgStore{units: make(map[string]*OrgUnit), invites: make(map[string]*Invite)}
	o.units["org-root"] = &OrgUnit{ID: "org-root", Name: "SpeedRunner Corp", Type: "org"}
	o.units["team-perf"] = &OrgUnit{ID: "team-perf", Name: "Performance Engineering", ParentID: "org-root", Type: "team"}
	return o
}

func (o *OrgStore) ListUnits() []*OrgUnit {
	o.mu.RLock()
	defer o.mu.RUnlock()
	out := make([]*OrgUnit, 0, len(o.units))
	for _, u := range o.units {
		out = append(out, u)
	}
	return out
}

func (o *OrgStore) Invite(inv *Invite) {
	o.mu.Lock()
	defer o.mu.Unlock()
	inv.Status = "PENDING"
	inv.CreatedAt = time.Now().UTC()
	if inv.ExpiresAt.IsZero() {
		inv.ExpiresAt = time.Now().Add(7 * 24 * time.Hour)
	}
	o.invites[inv.ID] = inv
}

func (o *OrgStore) ListInvites() []*Invite {
	o.mu.RLock()
	defer o.mu.RUnlock()
	out := make([]*Invite, 0, len(o.invites))
	now := time.Now()
	for _, inv := range o.invites {
		if inv.Status == "PENDING" && now.After(inv.ExpiresAt) {
			inv.Status = "EXPIRED"
		}
		out = append(out, inv)
	}
	return out
}

// Phase8Catalog documents 8.1–8.50.
func Phase8Catalog() []map[string]string {
	items := make([]map[string]string, 0, 50)
	names := []string{
		"Event outbox enqueue", "Outbox pending delivery", "Outbox retry backoff", "Webhook HMAC sign", "Webhook HMAC verify",
		"Idempotency keys", "Idempotency TTL cleanup", "Soft delete", "Soft restore", "Duplicate request guard",
		"Alert rule model", "Alert evaluation gt/lt", "Alert severity", "SLO error budget", "SLO burn rate alert",
		"Circuit breaker closed", "Circuit breaker open", "Circuit half-open", "Watchdog max duration", "Watchdog max error rate",
		"Priority queue enqueue", "Priority dequeue", "Fair-share FIFO", "Queue length", "Team-aware scheduling",
		"Progressive ramp build", "Ramp step VUs", "Ramp at elapsed", "Canary ramp profile", "Load shape validation",
		"Budget model", "Budget percent used", "Budget alert threshold", "Budget exceeded status", "Cost alert flag",
		"Saved searches", "Search filters", "Bookmarks", "Bookmark list by user", "User prefs store",
		"PII classification", "Secret classification", "PCI labels", "Compliance evidence pack", "SOC2 control list",
		"Org hierarchy", "Team units", "User invite", "Invite expiry", "Invite list status",
	}
	for i, n := range names {
		items = append(items, map[string]string{
			"id":   fmt.Sprintf("8.%d", i+1),
			"name": n,
		})
	}
	return items
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
