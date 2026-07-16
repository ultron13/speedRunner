package k8s

import (
	"context"
	"fmt"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// JobConfig holds configuration for creating a Kubernetes Job
type JobConfig struct {
	Name        string
	Namespace   string
	Image       string
	Command     []string
	Args        []string
	Env         map[string]string
	Labels      map[string]string
	Volumes     []VolumeConfig
	Resources   ResourceConfig
	BackoffLimit int32
	TTLSeconds   int32
}

type VolumeConfig struct {
	Name       string
	MountPath  string
	ReadOnly   bool
	ConfigMap  string
	EmptyDir   bool
}

type ResourceConfig struct {
	CPURequest    string
	MemoryRequest string
	CPULimit      string
	MemoryLimit   string
}

// CreateJob creates a Kubernetes Job
func (c *Client) CreateJob(ctx context.Context, config JobConfig) (*batchv1.Job, error) {
	if config.Namespace == "" {
		config.Namespace = c.Namespace
	}

	if config.BackoffLimit == 0 {
		config.BackoffLimit = 0
	}
	if config.TTLSeconds == 0 {
		config.TTLSeconds = 300
	}

	// Build environment variables
	envVars := make([]corev1.EnvVar, 0, len(config.Env))
	for key, value := range config.Env {
		envVars = append(envVars, corev1.EnvVar{
			Name:  key,
			Value: value,
		})
	}

	// Build volume mounts and volumes
	volumeMounts := make([]corev1.VolumeMount, 0, len(config.Volumes))
	volumes := make([]corev1.Volume, 0, len(config.Volumes))

	for _, vol := range config.Volumes {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      vol.Name,
			MountPath: vol.MountPath,
			ReadOnly:  vol.ReadOnly,
		})

		if vol.ConfigMap != "" {
			volumes = append(volumes, corev1.Volume{
				Name: vol.Name,
				VolumeSource: corev1.VolumeSource{
					ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{
							Name: vol.ConfigMap,
						},
					},
				},
			})
		} else if vol.EmptyDir {
			volumes = append(volumes, corev1.Volume{
				Name: vol.Name,
				VolumeSource: corev1.VolumeSource{
					EmptyDir: &corev1.EmptyDirVolumeSource{},
				},
			})
		}
	}

	// Parse resource requirements
	resources := corev1.ResourceRequirements{}
	if config.Resources.CPURequest != "" || config.Resources.MemoryRequest != "" {
		resources.Requests = corev1.ResourceList{}
		if config.Resources.CPURequest != "" {
			resources.Requests[corev1.ResourceCPU] = resource.MustParse(config.Resources.CPURequest)
		}
		if config.Resources.MemoryRequest != "" {
			resources.Requests[corev1.ResourceMemory] = resource.MustParse(config.Resources.MemoryRequest)
		}
	}
	if config.Resources.CPULimit != "" || config.Resources.MemoryLimit != "" {
		resources.Limits = corev1.ResourceList{}
		if config.Resources.CPULimit != "" {
			resources.Limits[corev1.ResourceCPU] = resource.MustParse(config.Resources.CPULimit)
		}
		if config.Resources.MemoryLimit != "" {
			resources.Limits[corev1.ResourceMemory] = resource.MustParse(config.Resources.MemoryLimit)
		}
	}

	// Create the Job
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      config.Name,
			Namespace: config.Namespace,
			Labels:    config.Labels,
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &config.BackoffLimit,
			TTLSecondsAfterFinished: &config.TTLSeconds,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: config.Labels,
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:         "main",
							Image:        config.Image,
							Command:      config.Command,
							Args:         config.Args,
							Env:          envVars,
							VolumeMounts: volumeMounts,
							Resources:    resources,
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/health",
										Port: intstr.FromInt(0),
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       10,
							},
						},
					},
					Volumes: volumes,
				},
			},
		},
	}

	createdJob, err := c.Clientset.BatchV1().Jobs(config.Namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create job %s: %w", config.Name, err)
	}

	return createdJob, nil
}

// GetJob retrieves a Job by name
func (c *Client) GetJob(ctx context.Context, name, namespace string) (*batchv1.Job, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	job, err := c.Clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get job %s: %w", name, err)
	}

	return job, nil
}

// DeleteJob deletes a Job by name
func (c *Client) DeleteJob(ctx context.Context, name, namespace string) error {
	if namespace == "" {
		namespace = c.Namespace
	}

	propagation := metav1.DeletePropagationForeground
	err := c.Clientset.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
	if err != nil {
		return fmt.Errorf("failed to delete job %s: %w", name, err)
	}

	return nil
}

// ListJobs lists Jobs with a label selector
func (c *Client) ListJobs(ctx context.Context, namespace, labelSelector string) ([]batchv1.Job, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	jobs, err := c.Clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	return jobs.Items, nil
}

// WaitForJob waits for a Job to complete or fail
func (c *Client) WaitForJob(ctx context.Context, name, namespace string, timeout time.Duration) (*batchv1.Job, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	deadline := time.Now().Add(timeout)
	for {
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timeout waiting for job %s", name)
		}

		job, err := c.GetJob(ctx, name, namespace)
		if err != nil {
			return nil, err
		}

		// Check if job is complete
		for _, condition := range job.Status.Conditions {
			if condition.Type == batchv1.JobComplete && condition.Status == corev1.ConditionTrue {
				return job, nil
			}
			if condition.Type == batchv1.JobFailed && condition.Status == corev1.ConditionTrue {
				return job, fmt.Errorf("job %s failed: %s", name, condition.Message)
			}
		}

		// Check active pods
		if job.Status.Active > 0 {
			// Job is still running
		} else if job.Status.Succeeded > 0 {
			return job, nil
		}

		time.Sleep(2 * time.Second)
	}
}
