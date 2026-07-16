package k6

import (
	"context"
	"fmt"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type K6Engine struct {
	clientset kubernetes.Interface
	namespace string
	image     string
}

func New(clientset kubernetes.Interface, namespace, image string) *K6Engine {
	return &K6Engine{
		clientset: clientset,
		namespace: namespace,
		image:     image,
	}
}

func (e *K6Engine) Name() string {
	return "k6"
}

func (e *K6Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	result := &engine.ExecutionResult{
		RunID:     req.RunID,
		Status:    "RUNNING",
		StartedAt: time.Now(),
	}

	labels := map[string]string{
		"app":                          "k6",
		"run-id":                       req.RunID,
		"test-id":                      req.TestID,
		"app.kubernetes.io/part-of":    "speedrunner",
		"app.kubernetes.io/component":  "execution",
		"app.kubernetes.io/managed-by": "speedrunner-backend",
	}
	for k, v := range req.Labels {
		labels[k] = v
	}

	// Create ConfigMap with k6 script
	script := fmt.Sprintf(`import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const duration = new Trend('duration');

export const options = {
  stages: [
    { duration: '%ds', target: %d },
    { duration: '%ds', target: %d },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const res = http.get('%s');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(res.status !== 200);
  duration.add(res.timings.duration);
  sleep(1);
}

export function handleSummary(data) {
  return {
    '/results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: false }),
  };
}`, req.RampUp, req.VirtualUsers, req.Duration, req.VirtualUsers, req.TargetURL)

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("k6-test-script-%s", req.RunID),
			Namespace: e.namespace,
			Labels:    labels,
		},
		Data: map[string]string{
			"test.js": script,
		},
	}

	_, err := e.clientset.CoreV1().ConfigMaps(e.namespace).Create(ctx, configMap, metav1.CreateOptions{})
	if err != nil {
		result.Status = "FAILED"
		result.Error = fmt.Errorf("failed to create configmap: %w", err)
		return result, result.Error
	}

	// Create Job
	backoffLimit := int32(0)
	ttl := int32(300)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("k6-%s", req.RunID),
			Namespace: e.namespace,
			Labels:    labels,
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttl,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:  "k6",
							Image: e.image,
							Command: []string{
								"k6", "run",
								"--out", "json=/results/metrics.json",
								"/scripts/test.js",
							},
							Env: []corev1.EnvVar{
								{Name: "RUN_ID", Value: req.RunID},
								{Name: "TARGET_URL", Value: req.TargetURL},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("250m"),
									corev1.ResourceMemory: resource.MustParse("256Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("500m"),
									corev1.ResourceMemory: resource.MustParse("512Mi"),
								},
							},
							VolumeMounts: []corev1.VolumeMount{
								{Name: "test-script", MountPath: "/scripts", ReadOnly: true},
								{Name: "results", MountPath: "/results"},
							},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "test-script",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: fmt.Sprintf("k6-test-script-%s", req.RunID),
									},
								},
							},
						},
						{
							Name: "results",
							VolumeSource: corev1.VolumeSource{
								EmptyDir: &corev1.EmptyDirVolumeSource{},
							},
						},
					},
				},
			},
		},
	}

	_, err = e.clientset.BatchV1().Jobs(e.namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		result.Status = "FAILED"
		result.Error = fmt.Errorf("failed to create job: %w", err)
		return result, result.Error
	}

	return result, nil
}

func (e *K6Engine) GetStatus(ctx context.Context, runID string) (string, error) {
	job, err := e.clientset.BatchV1().Jobs(e.namespace).Get(ctx, fmt.Sprintf("k6-%s", runID), metav1.GetOptions{})
	if err != nil {
		return "", err
	}

	if job.Status.Succeeded > 0 {
		return "COMPLETED", nil
	}
	if job.Status.Failed > 0 {
		return "FAILED", nil
	}
	if job.Status.Active > 0 {
		return "RUNNING", nil
	}
	return "PENDING", nil
}

func (e *K6Engine) Cleanup(ctx context.Context, runID string) error {
	jobName := fmt.Sprintf("k6-%s", runID)
	configMapName := fmt.Sprintf("k6-test-script-%s", runID)

	_ = e.clientset.BatchV1().Jobs(e.namespace).Delete(ctx, jobName, metav1.DeleteOptions{})
	_ = e.clientset.CoreV1().ConfigMaps(e.namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	return nil
}
