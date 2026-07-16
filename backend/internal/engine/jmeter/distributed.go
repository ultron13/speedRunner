package jmeter

import (
	"context"
	"fmt"
	"time"

	"github.com/belo/speedrunner/backend/internal/k8s"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
)


// DistributedConfig holds configuration for distributed JMeter execution
type DistributedConfig struct {
	RunID        string
	TargetURL    string
	VirtualUsers int
	Duration     int
	RampUp       int
	WorkerCount  int
	Namespace    string
	Image        string
	Labels       map[string]string
}

// DistributedExecutor manages distributed JMeter execution
type DistributedExecutor struct {
	client *k8s.Client
}

// NewDistributedExecutor creates a new distributed executor
func NewDistributedExecutor(client *k8s.Client) *DistributedExecutor {
	return &DistributedExecutor{client: client}
}

// Execute starts a distributed JMeter test
func (d *DistributedExecutor) Execute(ctx context.Context, config DistributedConfig) (*DistributedResult, error) {
	if config.WorkerCount <= 0 {
		config.WorkerCount = 2
	}
	if config.Namespace == "" {
		config.Namespace = d.client.Namespace
	}

	result := &DistributedResult{
		RunID:     config.RunID,
		StartTime: time.Now(),
		Workers:   make([]WorkerResult, 0, config.WorkerCount),
	}

	// Create coordinator job
	coordinatorConfig := k8s.JobConfig{
		Name:      fmt.Sprintf("jmeter-coordinator-%s", config.RunID),
		Namespace: config.Namespace,
		Image:     config.Image,
		Command:   []string{"/bin/sh", "-c"},
		Args: []string{
			fmt.Sprintf("jmeter -n -t /test-plan/test-plan.jmx -R %s -l /results/results.jtl -j /results/jmeter.log",
				d.generateWorkerHostnames(config)),
		},
		Env: map[string]string{
			"RUN_ID":        config.RunID,
			"TARGET_URL":    config.TargetURL,
			"VIRTUAL_USERS": fmt.Sprintf("%d", config.VirtualUsers),
			"DURATION":      fmt.Sprintf("%d", config.Duration),
		},
		Labels: map[string]string{
			"app":                          "jmeter",
			"role":                         "coordinator",
			"run-id":                       config.RunID,
			"app.kubernetes.io/part-of":    "speedrunner",
			"app.kubernetes.io/component":  "coordinator",
			"app.kubernetes.io/managed-by": "speedrunner-backend",
		},
		Volumes: []k8s.VolumeConfig{
			{Name: "test-plan", MountPath: "/test-plan", ConfigMap: fmt.Sprintf("jmeter-test-plan-%s", config.RunID)},
			{Name: "results", MountPath: "/results", EmptyDir: true},
		},
		Resources: k8s.ResourceConfig{
			CPURequest:    "250m",
			MemoryRequest: "256Mi",
			CPULimit:      "500m",
			MemoryLimit:   "512Mi",
		},
	}

	// Add labels from config
	for k, v := range config.Labels {
		coordinatorConfig.Labels[k] = v
	}

	coordinatorJob, err := d.client.CreateJob(ctx, coordinatorConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create coordinator job: %w", err)
	}

	result.CoordinatorJob = coordinatorJob.Name

	// Create worker jobs
	for i := 0; i < config.WorkerCount; i++ {
		workerConfig := k8s.JobConfig{
			Name:      fmt.Sprintf("jmeter-worker-%s-%d", config.RunID, i),
			Namespace: config.Namespace,
			Image:     config.Image,
			Command:   []string{"/bin/sh", "-c"},
			Args: []string{
				"jmeter -n -t /test-plan/test-plan.jmx -Dserver_port=50000 -l /results/results.jtl -j /results/jmeter.log",
			},
			Env: map[string]string{
				"RUN_ID":        config.RunID,
				"TARGET_URL":    config.TargetURL,
				"VIRTUAL_USERS": fmt.Sprintf("%d", config.VirtualUsers/config.WorkerCount),
				"DURATION":      fmt.Sprintf("%d", config.Duration),
				"WORKER_INDEX":  fmt.Sprintf("%d", i),
			},
			Labels: map[string]string{
				"app":                          "jmeter",
				"role":                         "worker",
				"run-id":                       config.RunID,
				"worker-index":                 fmt.Sprintf("%d", i),
				"app.kubernetes.io/part-of":    "speedrunner",
				"app.kubernetes.io/component":  "worker",
				"app.kubernetes.io/managed-by": "speedrunner-backend",
			},
			Volumes: []k8s.VolumeConfig{
				{Name: "test-plan", MountPath: "/test-plan", ConfigMap: fmt.Sprintf("jmeter-test-plan-%s", config.RunID)},
				{Name: "results", MountPath: "/results", EmptyDir: true},
			},
			Resources: k8s.ResourceConfig{
				CPURequest:    "500m",
				MemoryRequest: "512Mi",
				CPULimit:      "1",
				MemoryLimit:   "1Gi",
			},
		}

		for k, v := range config.Labels {
			workerConfig.Labels[k] = v
		}

		workerJob, err := d.client.CreateJob(ctx, workerConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create worker job %d: %w", i, err)
		}

		result.Workers = append(result.Workers, WorkerResult{
			Index: i,
			Job:   workerJob.Name,
		})
	}

	return result, nil
}

// generateWorkerHostnames generates comma-separated worker hostnames
func (d *DistributedExecutor) generateWorkerHostnames(config DistributedConfig) string {
	hostnames := make([]string, config.WorkerCount)
	for i := 0; i < config.WorkerCount; i++ {
		hostnames[i] = fmt.Sprintf("jmeter-worker-%s-%d.%s.svc.cluster.local", config.RunID, i, config.Namespace)
	}
	return joinStrings(hostnames, ",")
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

// DistributedResult contains the result of distributed execution
type DistributedResult struct {
	RunID           string
	CoordinatorJob string
	Workers         []WorkerResult
	StartTime       time.Time
}

type WorkerResult struct {
	Index int
	Job   string
}

// WaitForCompletion waits for all jobs to complete
func (d *DistributedExecutor) WaitForCompletion(ctx context.Context, result *DistributedResult, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	// Wait for coordinator
	coordinatorJob, err := d.client.WaitForJob(ctx, result.CoordinatorJob, result.Workers[0].Job, deadline.Sub(time.Now()))
	if err != nil {
		return fmt.Errorf("coordinator job failed: %w", err)
	}

	// Check coordinator status
	for _, condition := range coordinatorJob.Status.Conditions {
		if condition.Type == batchv1.JobFailed && condition.Status == corev1.ConditionTrue {
			return fmt.Errorf("coordinator job failed: %s", condition.Message)
		}
	}

	return nil
}
