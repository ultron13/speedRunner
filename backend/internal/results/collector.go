package results

import (
	"context"
	"fmt"
	"time"

	"github.com/belo/speedrunner/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Collector collects results from completed test runs
type Collector struct {
	client *k8s.Client
}

// NewCollector creates a new result collector
func NewCollector(client *k8s.Client) *Collector {
	return &Collector{client: client}
}

// CollectRunResults collects results from a completed run
func (c *Collector) CollectRunResults(ctx context.Context, runID, namespace string) (*CollectedResults, error) {
	if namespace == "" {
		namespace = c.client.Namespace
	}

	result := &CollectedResults{
		RunID:       runID,
		CollectedAt: time.Now(),
	}

	// List pods for this run
	pods, err := c.client.ListPods(ctx, namespace, fmt.Sprintf("run-id=%s", runID))
	if err != nil {
		return nil, fmt.Errorf("failed to list pods for run %s: %w", runID, err)
	}

	// Collect logs from each pod
	for _, pod := range pods {
		logs, err := c.client.GetPodLogs(ctx, pod.Name, namespace, "")
		if err != nil {
			// Log error but continue collecting from other pods
			continue
		}

		result.PodLogs = append(result.PodLogs, PodLog{
			PodName: pod.Name,
			Logs:    logs,
		})
	}

	// Collect ConfigMaps with results
	configMaps, err := c.client.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("run-id=%s,app.kubernetes.io/component=results", runID),
	})
	if err == nil {
		for _, cm := range configMaps.Items {
			for key, value := range cm.Data {
				result.Artifacts = append(result.Artifacts, Artifact{
					Name:    key,
					Content: value,
					Type:    "configmap",
				})
			}
		}
	}

	return result, nil
}

// CollectedResults contains collected results from a run
type CollectedResults struct {
	RunID       string
	CollectedAt time.Time
	PodLogs     []PodLog
	Artifacts   []Artifact
}

// PodLog contains logs from a pod
type PodLog struct {
	PodName string
	Logs    string
}

// Artifact contains a collected artifact
type Artifact struct {
	Name    string
	Content string
	Type    string
}
