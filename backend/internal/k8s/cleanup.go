package k8s

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CleanupConfig holds configuration for resource cleanup
type CleanupConfig struct {
	Namespace   string
	JobName     string
	ConfigMaps  []string
	Secrets     []string
	KeepJob     bool
	KeepPods    bool
	MaxAge      time.Duration
}

// CleanupRunResources cleans up all resources associated with a test run
func (c *Client) CleanupRunResources(ctx context.Context, config CleanupConfig) error {
	if config.Namespace == "" {
		config.Namespace = c.Namespace
	}

	var errors []error

	// Delete Job if not keeping
	if !config.KeepJob && config.JobName != "" {
		if err := c.DeleteJob(ctx, config.JobName, config.Namespace); err != nil {
			errors = append(errors, fmt.Errorf("failed to delete job: %w", err))
		}
	}

	// Delete ConfigMaps
	for _, name := range config.ConfigMaps {
		if err := c.Clientset.CoreV1().ConfigMaps(config.Namespace).Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
			errors = append(errors, fmt.Errorf("failed to delete configmap %s: %w", name, err))
		}
	}

	// Delete Secrets
	for _, name := range config.Secrets {
		if err := c.Clientset.CoreV1().Secrets(config.Namespace).Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
			errors = append(errors, fmt.Errorf("failed to delete secret %s: %w", name, err))
		}
	}

	// Delete Pods if not keeping
	if !config.KeepPods {
		labelSelector := fmt.Sprintf("job-name=%s", config.JobName)
		pods, err := c.ListPods(ctx, config.Namespace, labelSelector)
		if err == nil {
			for _, pod := range pods {
				if err := c.DeletePod(ctx, pod.Name, config.Namespace); err != nil {
					errors = append(errors, fmt.Errorf("failed to delete pod %s: %w", pod.Name, err))
				}
			}
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("cleanup errors: %v", errors)
	}

	return nil
}

// CleanupStaleResources removes resources older than maxAge
func (c *Client) CleanupStaleResources(ctx context.Context, namespace string, maxAge time.Duration) error {
	if namespace == "" {
		namespace = c.Namespace
	}

	cutoff := time.Now().Add(-maxAge)

	// List all jobs
	jobs, err := c.ListJobs(ctx, namespace, "")
	if err != nil {
		return fmt.Errorf("failed to list jobs: %w", err)
	}

	for _, job := range jobs {
		if job.CreationTimestamp.Time.Before(cutoff) {
			// Delete completed or failed jobs
			if job.Status.Succeeded > 0 || job.Status.Failed > 0 {
				_ = c.DeleteJob(ctx, job.Name, namespace)
			}
		}
	}

	return nil
}
