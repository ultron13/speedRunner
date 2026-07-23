package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// FileStorage is durable object storage on the local filesystem (and works under
// MinIO PVC mounts). Suitable for minikube/compose without requiring minio-go.
type FileStorage struct {
	root string
}

func NewFileStorage(root string) (*FileStorage, error) {
	if root == "" {
		root = "./data/artifacts"
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("artifact root: %w", err)
	}
	for _, b := range []string{BucketArtifacts, BucketResults, BucketReports} {
		if err := os.MkdirAll(filepath.Join(root, b), 0o755); err != nil {
			return nil, err
		}
	}
	return &FileStorage{root: root}, nil
}

func (f *FileStorage) path(bucket, key string) string {
	key = strings.TrimPrefix(key, "/")
	return filepath.Join(f.root, bucket, filepath.FromSlash(key))
}

func (f *FileStorage) Put(ctx context.Context, bucket, key string, reader io.Reader, contentType string) error {
	_ = ctx
	p := f.path(bucket, key)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	tmp := p + ".tmp"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, reader); err != nil {
		_ = out.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	// sidecar content-type
	_ = os.WriteFile(p+".ctype", []byte(contentType), 0o644)
	return os.Rename(tmp, p)
}

func (f *FileStorage) Get(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	_ = ctx
	p := f.path(bucket, key)
	return os.Open(p)
}

func (f *FileStorage) Delete(ctx context.Context, bucket, key string) error {
	_ = ctx
	p := f.path(bucket, key)
	_ = os.Remove(p + ".ctype")
	return os.Remove(p)
}

func (f *FileStorage) List(ctx context.Context, bucket, prefix string) ([]ObjectInfo, error) {
	_ = ctx
	base := filepath.Join(f.root, bucket)
	var out []ObjectInfo
	err := filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".ctype") {
			return nil
		}
		rel, _ := filepath.Rel(base, path)
		key := filepath.ToSlash(rel)
		if prefix != "" && !strings.HasPrefix(key, prefix) {
			return nil
		}
		ct := "application/octet-stream"
		if b, err := os.ReadFile(path + ".ctype"); err == nil {
			ct = string(b)
		}
		out = append(out, ObjectInfo{
			Key: key, Size: info.Size(), ContentType: ct, LastModified: info.ModTime(),
		})
		return nil
	})
	return out, err
}

func (f *FileStorage) Exists(ctx context.Context, bucket, key string) (bool, error) {
	_ = ctx
	_, err := os.Stat(f.path(bucket, key))
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

// NewDefaultObjectStorage returns file storage under ARTIFACT_DIR (or ./data/artifacts).
func NewDefaultObjectStorage() ObjectStorage {
	root := os.Getenv("ARTIFACT_DIR")
	if root == "" {
		root = "./data/artifacts"
	}
	fs, err := NewFileStorage(root)
	if err != nil {
		fmt.Printf("[storage] file storage init failed: %v — using memory\n", err)
		return NewMemoryStorage()
	}
	fmt.Printf("[storage] durable file artifacts at %s\n", root)
	return fs
}

// Ensure ObjectStorage compile-time checks
var (
	_ ObjectStorage = (*FileStorage)(nil)
	_ ObjectStorage = (*MemoryStorage)(nil)
	_ ObjectStorage = (*MinIOStorage)(nil)
)

// Age helper for listing
func (o ObjectInfo) Age() time.Duration {
	return time.Since(o.LastModified)
}
