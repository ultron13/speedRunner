package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// EventType identifies platform lifecycle events delivered to webhooks.
type EventType string

const (
	EventRunStarted   EventType = "run.started"
	EventRunCompleted EventType = "run.completed"
	EventRunFailed    EventType = "run.failed"
	EventRunStopped   EventType = "run.stopped"
	EventTestCreated  EventType = "test.created"
	EventSLABreach    EventType = "sla.breach"
)

// Webhook is a registered outbound notification target.
type Webhook struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	URL     string   `json:"url"`
	Secret  string   `json:"-"`
	Events  []string `json:"events"`
	Enabled bool     `json:"enabled"`
}

// EventPayload is the JSON body posted to webhook URLs.
type EventPayload struct {
	Event     EventType              `json:"event"`
	Timestamp time.Time              `json:"timestamp"`
	RunID     string                 `json:"runId,omitempty"`
	TestID    string                 `json:"testId,omitempty"`
	ProjectID string                 `json:"projectId,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// Dispatcher delivers events to registered webhooks.
type Dispatcher struct {
	mu       sync.RWMutex
	hooks    map[string]*Webhook
	client   *http.Client
	delivery []DeliveryRecord
}

// DeliveryRecord stores recent delivery attempts for audit/debug.
type DeliveryRecord struct {
	WebhookID  string    `json:"webhookId"`
	Event      EventType `json:"event"`
	StatusCode int       `json:"statusCode"`
	Success    bool      `json:"success"`
	Error      string    `json:"error,omitempty"`
	At         time.Time `json:"at"`
}

func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		hooks: make(map[string]*Webhook),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		delivery: make([]DeliveryRecord, 0, 100),
	}
}

func (d *Dispatcher) Register(h *Webhook) {
	d.mu.Lock()
	defer d.mu.Unlock()
	h.Enabled = true
	d.hooks[h.ID] = h
}

func (d *Dispatcher) Unregister(id string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.hooks, id)
}

func (d *Dispatcher) List() []*Webhook {
	d.mu.RLock()
	defer d.mu.RUnlock()
	out := make([]*Webhook, 0, len(d.hooks))
	for _, h := range d.hooks {
		out = append(out, h)
	}
	return out
}

func (d *Dispatcher) wants(h *Webhook, event EventType) bool {
	if !h.Enabled {
		return false
	}
	if len(h.Events) == 0 {
		return true
	}
	ev := string(event)
	for _, e := range h.Events {
		if e == "*" || e == ev {
			return true
		}
	}
	return false
}

// Publish sends the event to all matching webhooks (best-effort, concurrent).
func (d *Dispatcher) Publish(ctx context.Context, payload EventPayload) {
	d.mu.RLock()
	targets := make([]*Webhook, 0)
	for _, h := range d.hooks {
		if d.wants(h, payload.Event) {
			targets = append(targets, h)
		}
	}
	d.mu.RUnlock()

	if payload.Timestamp.IsZero() {
		payload.Timestamp = time.Now().UTC()
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	for _, h := range targets {
		go d.deliver(ctx, h, payload.Event, body)
	}
}

func (d *Dispatcher) deliver(ctx context.Context, h *Webhook, event EventType, body []byte) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.URL, bytes.NewReader(body))
	if err != nil {
		d.record(h.ID, event, 0, false, err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SpeedRunner-Webhook/1.0")
	req.Header.Set("X-SpeedRunner-Event", string(event))
	if h.Secret != "" {
		req.Header.Set("X-SpeedRunner-Secret", h.Secret)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		d.record(h.ID, event, 0, false, err.Error())
		return
	}
	defer resp.Body.Close()
	ok := resp.StatusCode >= 200 && resp.StatusCode < 300
	msg := ""
	if !ok {
		msg = fmt.Sprintf("unexpected status %d", resp.StatusCode)
	}
	d.record(h.ID, event, resp.StatusCode, ok, msg)
}

func (d *Dispatcher) record(id string, event EventType, code int, ok bool, errMsg string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.delivery = append(d.delivery, DeliveryRecord{
		WebhookID:  id,
		Event:      event,
		StatusCode: code,
		Success:    ok,
		Error:      errMsg,
		At:         time.Now().UTC(),
	})
	if len(d.delivery) > 200 {
		d.delivery = d.delivery[len(d.delivery)-200:]
	}
}

func (d *Dispatcher) RecentDeliveries(limit int) []DeliveryRecord {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if limit <= 0 || limit > len(d.delivery) {
		limit = len(d.delivery)
	}
	start := len(d.delivery) - limit
	out := make([]DeliveryRecord, limit)
	copy(out, d.delivery[start:])
	return out
}
