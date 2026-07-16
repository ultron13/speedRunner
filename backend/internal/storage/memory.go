package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"
	"time"
)

// MemoryStorage is an in-process ObjectStorage for tests and local demos.
type MemoryStorage struct {
	mu   sync.RWMutex
	data map[string]map[string]memoryObj // bucket -> key -> object
}

type memoryObj struct {
	body        []byte
	contentType string
	modified    time.Time
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{data: make(map[string]map[string]memoryObj)}
}

func (m *MemoryStorage) Put(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error {
	body, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.data[bucket] == nil {
		m.data[bucket] = make(map[string]memoryObj)
	}
	m.data[bucket][key] = memoryObj{body: body, contentType: contentType, modified: time.Now().UTC()}
	return nil
}

func (m *MemoryStorage) Get(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	b, ok := m.data[bucket]
	if !ok {
		return nil, fmt.Errorf("bucket %s not found", bucket)
	}
	obj, ok := b[key]
	if !ok {
		return nil, fmt.Errorf("key %s not found", key)
	}
	return io.NopCloser(bytes.NewReader(obj.body)), nil
}

func (m *MemoryStorage) Delete(ctx context.Context, bucket, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if b, ok := m.data[bucket]; ok {
		delete(b, key)
	}
	return nil
}

func (m *MemoryStorage) List(ctx context.Context, bucket, prefix string) ([]ObjectInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	b := m.data[bucket]
	out := make([]ObjectInfo, 0)
	for k, obj := range b {
		if prefix != "" && (len(k) < len(prefix) || k[:len(prefix)] != prefix) {
			continue
		}
		out = append(out, ObjectInfo{
			Key:          k,
			Size:         int64(len(obj.body)),
			ContentType:  obj.contentType,
			LastModified: obj.modified,
		})
	}
	return out, nil
}

func (m *MemoryStorage) Exists(ctx context.Context, bucket, key string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	b, ok := m.data[bucket]
	if !ok {
		return false, nil
	}
	_, ok = b[key]
	return ok, nil
}
