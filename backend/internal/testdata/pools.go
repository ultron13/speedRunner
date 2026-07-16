package testdata

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	redisclient "github.com/belo/speedrunner/backend/internal/redis"
)

// Pool defines a durable test-data pool definition.
type Pool struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	KeyPrefix   string            `json:"keyPrefix"`
	Partition   string            `json:"partition,omitempty"`
	ItemCount   int               `json:"itemCount"`
	TTLSeconds  int               `json:"ttlSeconds"`
	Masked      bool              `json:"masked"`
	SampleKeys  []string          `json:"sampleKeys,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	LastLoadAt  *time.Time        `json:"lastLoadAt,omitempty"`
	Exhausted   bool              `json:"exhausted"`
}

// Manager stores pool definitions in memory and optional Redis preload.
type Manager struct {
	mu    sync.RWMutex
	pools map[string]*Pool
	redis *redisclient.RedisClient
}

func NewManager(redis *redisclient.RedisClient) *Manager {
	return &Manager{pools: make(map[string]*Pool), redis: redis}
}

func (m *Manager) List() []*Pool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Pool, 0, len(m.pools))
	for _, p := range m.pools {
		out = append(out, p)
	}
	return out
}

func (m *Manager) Get(id string) (*Pool, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.pools[id]
	return p, ok
}

func (m *Manager) Create(p *Pool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	if p.KeyPrefix == "" {
		p.KeyPrefix = "speedrunner:data:" + p.ID
	}
	if p.TTLSeconds <= 0 {
		p.TTLSeconds = 3600
	}
	m.pools[p.ID] = p
}

func (m *Manager) Delete(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.pools, id)
}

// Preload writes synthetic (optionally masked) items into Redis for a pool.
func (m *Manager) Preload(ctx context.Context, id string, count int) error {
	m.mu.Lock()
	p, ok := m.pools[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("pool %s not found", id)
	}
	if count <= 0 {
		count = p.ItemCount
	}
	if count <= 0 {
		count = 100
	}
	prefix := p.KeyPrefix
	ttl := time.Duration(p.TTLSeconds) * time.Second
	masked := p.Masked
	m.mu.Unlock()

	if m.redis == nil {
		// Still update metadata for demo mode
		m.mu.Lock()
		if p, ok := m.pools[id]; ok {
			now := time.Now().UTC()
			p.LastLoadAt = &now
			p.ItemCount = count
			p.Exhausted = false
			p.SampleKeys = []string{prefix + ":0", prefix + ":1"}
		}
		m.mu.Unlock()
		return nil
	}

	samples := make([]string, 0, 5)
	for i := 0; i < count; i++ {
		key := fmt.Sprintf("%s:%d", prefix, i)
		val := map[string]interface{}{
			"id":    i,
			"email": fmt.Sprintf("user%d@example.com", i),
			"token": fmt.Sprintf("tok-%d", i),
		}
		if masked {
			val["email"] = fmt.Sprintf("user%d@***.com", i)
			val["token"] = "***"
		}
		b, _ := json.Marshal(val)
		if err := m.redis.Set(ctx, key, string(b), ttl); err != nil {
			return err
		}
		if i < 5 {
			samples = append(samples, key)
		}
	}

	m.mu.Lock()
	if p, ok := m.pools[id]; ok {
		now := time.Now().UTC()
		p.LastLoadAt = &now
		p.ItemCount = count
		p.Exhausted = false
		p.SampleKeys = samples
	}
	m.mu.Unlock()
	return nil
}

// CheckExhaustion marks pools with zero remaining keys (best-effort).
func (m *Manager) CheckExhaustion(ctx context.Context, id string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.pools[id]
	if !ok {
		return false, fmt.Errorf("pool not found")
	}
	// Without SCAN support, use item count heuristic
	if p.ItemCount == 0 {
		p.Exhausted = true
		return true, nil
	}
	return p.Exhausted, nil
}
