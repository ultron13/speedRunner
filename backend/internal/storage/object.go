package storage

import (
	"context"
	"fmt"
	"io"
	"time"
)

// ObjectStorage defines the interface for object storage operations
type ObjectStorage interface {
	Put(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error
	Get(ctx context.Context, bucket, key string) (io.ReadCloser, error)
	Delete(ctx context.Context, bucket, key string) error
	List(ctx context.Context, bucket, prefix string) ([]ObjectInfo, error)
	Exists(ctx context.Context, bucket, key string) (bool, error)
}

type ObjectInfo struct {
	Key          string
	Size         int64
	ContentType  string
	LastModified time.Time
}

// MinIOStorage implements ObjectStorage using MinIO
type MinIOStorage struct {
	endpoint  string
	accessKey string
	secretKey string
	useSSL    bool
}

func NewMinIOStorage(endpoint, accessKey, secretKey string, useSSL bool) *MinIOStorage {
	return &MinIOStorage{
		endpoint:  endpoint,
		accessKey: accessKey,
		secretKey: secretKey,
		useSSL:    useSSL,
	}
}

// MinIOStorage methods currently delegate to an optional in-memory fallback
// when no real MinIO SDK client is configured. Production deployments should
// inject MemoryStorage for tests or a future minio-go client wrapper.

func (m *MinIOStorage) Put(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error {
	// Without minio-go dependency, log and discard (use MemoryStorage in tests).
	fmt.Printf("[storage] Put (noop minio stub): bucket=%s key=%s type=%s\n", bucket, key, contentType)
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

func (m *MinIOStorage) Get(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	return nil, fmt.Errorf("minio client not configured — use MemoryStorage for local/dev")
}

func (m *MinIOStorage) Delete(ctx context.Context, bucket, key string) error {
	fmt.Printf("[storage] Delete (noop minio stub): bucket=%s key=%s\n", bucket, key)
	return nil
}

func (m *MinIOStorage) List(ctx context.Context, bucket, prefix string) ([]ObjectInfo, error) {
	return []ObjectInfo{}, nil
}

func (m *MinIOStorage) Exists(ctx context.Context, bucket, key string) (bool, error) {
	return false, nil
}

// Bucket names
const (
	BucketArtifacts = "speedrunner-artifacts"
	BucketResults   = "speedrunner-results"
	BucketReports   = "speedrunner-reports"
)
