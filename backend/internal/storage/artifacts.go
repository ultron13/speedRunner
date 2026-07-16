package storage

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"time"
)

// ArtifactManager manages test artifacts storage
type ArtifactManager struct {
	storage ObjectStorage
}

func NewArtifactManager(storage ObjectStorage) *ArtifactManager {
	return &ArtifactManager{storage: storage}
}

// UploadTestPlan uploads a JMeter/k6 test plan
func (a *ArtifactManager) UploadTestPlan(ctx context.Context, runID, engine, content string) error {
	key := fmt.Sprintf("test-plans/%s/%s/%s.jmx", runID, engine, runID)
	return a.storage.Put(ctx, BucketArtifacts, key, 
		io.NopCloser(nil), "application/xml")
}

// UploadResultFile uploads JTL or other result files
func (a *ArtifactManager) UploadResultFile(ctx context.Context, runID, filename string, reader io.Reader) error {
	key := fmt.Sprintf("results/%s/%s", runID, filename)
	return a.storage.Put(ctx, BucketResults, key, reader, "application/xml")
}

// UploadLog uploads engine logs
func (a *ArtifactManager) UploadLog(ctx context.Context, runID, filename string, reader io.Reader) error {
	key := fmt.Sprintf("logs/%s/%s", runID, filename)
	return a.storage.Put(ctx, BucketArtifacts, key, reader, "text/plain")
}

// GetResultFile retrieves a result file
func (a *ArtifactManager) GetResultFile(ctx context.Context, runID, filename string) (io.ReadCloser, error) {
	key := fmt.Sprintf("results/%s/%s", runID, filename)
	return a.storage.Get(ctx, BucketResults, key)
}

// ListRunArtifacts lists all artifacts for a run
func (a *ArtifactManager) ListRunArtifacts(ctx context.Context, runID string) ([]ObjectInfo, error) {
	return a.storage.List(ctx, BucketArtifacts, fmt.Sprintf("artifacts/%s/", runID))
}

// CleanupOldArtifacts removes artifacts older than retention period
func (a *ArtifactManager) CleanupOldArtifacts(ctx context.Context, retentionDays int) (int, error) {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	_ = cutoff
	// TODO: Implement cleanup logic
	return 0, nil
}

func init() {
	_ = filepath.Base
}
