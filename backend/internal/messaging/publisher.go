package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// EventType represents the type of domain event
type EventType string

const (
	EventTestRunRequested  EventType = "TestRunRequested"
	EventTestRunApproved   EventType = "TestRunApproved"
	EventTestRunStarted    EventType = "TestRunStarted"
	EventTestRunCompleted  EventType = "TestRunCompleted"
	EventTestRunFailed     EventType = "TestRunFailed"
	EventTestRunCancelled  EventType = "TestRunCancelled"
	EventResultIngested    EventType = "ResultIngested"
	EventThresholdBreached EventType = "ThresholdBreached"
	EventNotificationSent  EventType = "NotificationSent"
)

// Event represents a domain event
type Event struct {
	ID        string                 `json:"id"`
	Type      EventType              `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]string      `json:"metadata,omitempty"`
}

// Publisher publishes events to Redis Streams
type Publisher struct {
	client    *redis.Client
	streamKey string
}

func NewPublisher(client *redis.Client, streamKey string) *Publisher {
	return &Publisher{
		client:    client,
		streamKey: streamKey,
	}
}

// Publish publishes an event to the stream
func (p *Publisher) Publish(ctx context.Context, event Event) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	cmd := p.client.XAdd(ctx, &redis.XAddArgs{
		Stream: p.streamKey,
		Values: map[string]interface{}{
			"event": string(data),
			"type":  string(event.Type),
		},
	})

	return cmd.Err()
}

// PublishTestRunEvent publishes a test run event
func (p *Publisher) PublishTestRunEvent(ctx context.Context, eventType EventType, runID, testID string, extra map[string]interface{}) error {
	payload := map[string]interface{}{
		"run_id":  runID,
		"test_id": testID,
	}
	for k, v := range extra {
		payload[k] = v
	}

	event := Event{
		ID:        fmt.Sprintf("%s-%s-%d", eventType, runID, time.Now().UnixNano()),
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now(),
	}

	return p.Publish(ctx, event)
}
