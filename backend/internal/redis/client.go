package redis

import (
	"context"
	"fmt"

	"time"

	"github.com/redis/go-redis/v9"

	"github.com/belo/speedrunner/backend/internal/config"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedis(cfg config.RedisConfig) *RedisClient {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.URL,
		Password: "",
		DB:       0,
	})
	return &RedisClient{client: client}
}

func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return r.client.Set(ctx, key, value, ttl).Err()
}

func (r *RedisClient) Del(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisClient) HSet(ctx context.Context, key string, values ...interface{}) error {
	return r.client.HSet(ctx, key, values...).Err()
}

func (r *RedisClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

func (r *RedisClient) Publish(ctx context.Context, channel string, message interface{}) error {
	return r.client.Publish(ctx, channel, message).Err()
}

func (r *RedisClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.client.Subscribe(ctx, channels...)
}

func RunKey(runID string) string {
	return fmt.Sprintf("speedrunner:run:%s", runID)
}

func RunMetricsKey(runID string) string {
	return fmt.Sprintf("speedrunner:run:%s:metrics", runID)
}

func RunStatusKey(runID string) string {
	return fmt.Sprintf("speedrunner:run:%s:status", runID)
}
