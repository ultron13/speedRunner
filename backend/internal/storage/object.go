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

func (m *MinIOStorage) Put(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error {
	// TODO: Implement with MinIO client
	fmt.Printf("[storage] Put: bucket=%s key=%s type=%s\n", bucket, key, contentType)
	return nil
}

func (m *MinIOStorage) Get(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	// TODO: Implement with MinIO client
	fmt.Printf("[storage] Get: bucket=%s key=%s\n", bucket, key)
	return nil, fmt.Errorf("not implemented")
}

func (m *MinIOStorage) Delete(ctx context.Context, bucket, key string) error {
	// TODO: Implement with MinIO client
	fmt.Printf("[storage] Delete: bucket=%s key=%s\n", bucket, key)
	return nil
}

func (m *MinIOStorage) List(ctx context.Context, bucket, prefix string) ([]ObjectInfo, error) {
	// TODO: Implement with MinIO client
	fmt.Printf("[storage] List: bucket=%s prefix=%s\n", bucket, prefix)
	return nil, nil
}

func (m *MinIOStorage) Exists(ctx context.Context, bucket, key string) (bool, error) {
	// TODO: Implement with MinIO client
	fmt.Printf("[storage] Exists: bucket=%s key=%s\n", bucket, key)
	return false, nil
}

// Bucket names
const (
	BucketArtifacts = "speedrunner-artifacts"
	BucketResults   = "speedrunner-results"
	BucketReports   = "speedrunner-reports"
)
