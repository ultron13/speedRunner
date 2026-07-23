package storage

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestFileStorageRoundTrip(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStorage(filepath.Join(dir, "arts"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	body := []byte(`{"runId":"r1","status":"COMPLETED"}`)
	if err := fs.Put(ctx, BucketResults, "runs/r1/summary.json", bytes.NewReader(body), "application/json"); err != nil {
		t.Fatal(err)
	}
	ok, err := fs.Exists(ctx, BucketResults, "runs/r1/summary.json")
	if err != nil || !ok {
		t.Fatal(ok, err)
	}
	rc, err := fs.Get(ctx, BucketResults, "runs/r1/summary.json")
	if err != nil {
		t.Fatal(err)
	}
	got, _ := io.ReadAll(rc)
	_ = rc.Close()
	if !bytes.Equal(got, body) {
		t.Fatalf("got %s", got)
	}
	list, err := fs.List(ctx, BucketResults, "runs/")
	if err != nil || len(list) != 1 {
		t.Fatal(list, err)
	}
	_ = os.RemoveAll(dir)
}
