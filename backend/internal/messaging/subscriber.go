package messaging

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// EventHandler processes events of a specific type
type EventHandler func(ctx context.Context, event Event) error

// Subscriber subscribes to events from Redis Streams
type Subscriber struct {
	client    *redis.Client
	streamKey string
	group     string
	consumer  string
	handlers  map[EventType][]EventHandler
}

func NewSubscriber(client *redis.Client, streamKey, group, consumer string) *Subscriber {
	return &Subscriber{
		client:    client,
		streamKey: streamKey,
		group:     group,
		consumer:  consumer,
		handlers:  make(map[EventType][]EventHandler),
	}
}

// Subscribe registers a handler for an event type
func (s *Subscriber) Subscribe(eventType EventType, handler EventHandler) {
	s.handlers[eventType] = append(s.handlers[eventType], handler)
}

// Start begins consuming events
func (s *Subscriber) Start(ctx context.Context) error {
	// Create consumer group if it doesn't exist
	err := s.client.XGroupCreateMkStream(ctx, s.streamKey, s.group, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("failed to create consumer group: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			s.processMessages(ctx)
		}
	}
}

func (s *Subscriber) processMessages(ctx context.Context) {
	results, err := s.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    s.group,
		Consumer: s.consumer,
		Streams:  []string{s.streamKey, ">"},
		Count:    10,
		Block:    0,
	}).Result()

	if err != nil {
		return
	}

	for _, stream := range results {
		for _, msg := range stream.Messages {
			s.processMessage(ctx, msg)
		}
	}
}

func (s *Subscriber) processMessage(ctx context.Context, msg redis.XMessage) {
	eventData, ok := msg.Values["event"].(string)
	if !ok {
		return
	}

	var event Event
	if err := json.Unmarshal([]byte(eventData), &event); err != nil {
		return
	}

	handlers, ok := s.handlers[event.Type]
	if !ok {
		return
	}

	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			fmt.Printf("[messaging] Error handling event %s: %v\n", event.Type, err)
		}
	}

	// Acknowledge message
	s.client.XAck(ctx, s.streamKey, s.group, msg.ID)
}
