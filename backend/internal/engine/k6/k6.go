package k6

import (
	"context"
	"fmt"
	"strings"
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
	if image == "" {
		image = "grafana/k6:latest"
	}
	return &K6Engine{
		clientset: clientset,
		namespace: namespace,
		image:     image,
	}
}

func (e *K6Engine) Name() string { return "k6" }

func (e *K6Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	result := &engine.ExecutionResult{
		RunID:     req.RunID,
		Status:    "RUNNING",
		StartedAt: time.Now(),
	}

	ns := req.Namespace
	if ns == "" {
		ns = e.namespace
	}

	labels := map[string]string{
		"app":                          "k6",
		"run-id":                       truncateLabel(req.RunID),
		"test-id":                      truncateLabel(req.TestID),
		"app.kubernetes.io/part-of":    "speedrunner",
		"app.kubernetes.io/component":  "execution",
		"app.kubernetes.io/managed-by": "speedrunner-backend",
	}
	for k, v := range req.Labels {
		labels[k] = truncateLabel(v)
	}

	vus := req.VirtualUsers
	if vus <= 0 {
		vus = 10
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 300
	}
	rampUp := req.RampUp
	if rampUp <= 0 {
		rampUp = 30
	}
	// k6 stages: ramp then hold
	hold := duration - rampUp
	if hold < 10 {
		hold = 10
	}

	// Escape target URL for JS string
	target := strings.ReplaceAll(req.TargetURL, `\`, `\\`)
	target = strings.ReplaceAll(target, `'`, `\'`)

	script := fmt.Sprintf(`import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const duration = new Trend('custom_duration');

export const options = {
  stages: [
    { duration: '%ds', target: %d },
    { duration: '%ds', target: %d },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const res = http.get('%s');
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(res.status >= 400);
  duration.add(res.timings.duration);
  sleep(1);
}
`, rampUp, vus, hold, vus, target)

	cmName := fmt.Sprintf("k6-script-%s", shortID(req.RunID))
	jobName := fmt.Sprintf("k6-%s", shortID(req.RunID))

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: ns,
			Labels:    labels,
		},
		Data: map[string]string{
			"test.js": script,
		},
	}

	_, err := e.clientset.CoreV1().ConfigMaps(ns).Create(ctx, configMap, metav1.CreateOptions{})
	if err != nil {
		result.Status = "FAILED"
		result.Error = fmt.Errorf("failed to create configmap: %w", err)
		return result, result.Error
	}

	backoffLimit := int32(0)
	ttl := int32(600)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: ns,
			Labels:    labels,
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttl,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:    "k6",
							Image:   e.image,
							Command: []string{"k6", "run", "/scripts/test.js"},
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
									corev1.ResourceCPU:    resource.MustParse("1"),
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
									LocalObjectReference: corev1.LocalObjectReference{Name: cmName},
								},
							},
						},
						{
							Name:         "results",
							VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
						},
					},
				},
			},
		},
	}

	_, err = e.clientset.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		_ = e.clientset.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
		result.Status = "FAILED"
		result.Error = fmt.Errorf("failed to create job: %w", err)
		return result, result.Error
	}

	return result, nil
}

func (e *K6Engine) GetStatus(ctx context.Context, runID string) (string, error) {
	jobName := fmt.Sprintf("k6-%s", shortID(runID))
	job, err := e.clientset.BatchV1().Jobs(e.namespace).Get(ctx, jobName, metav1.GetOptions{})
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
	jobName := fmt.Sprintf("k6-%s", shortID(runID))
	cmName := fmt.Sprintf("k6-script-%s", shortID(runID))
	propagation := metav1.DeletePropagationBackground
	_ = e.clientset.BatchV1().Jobs(e.namespace).Delete(ctx, jobName, metav1.DeleteOptions{PropagationPolicy: &propagation})
	_ = e.clientset.CoreV1().ConfigMaps(e.namespace).Delete(ctx, cmName, metav1.DeleteOptions{})
	return nil
}

func shortID(id string) string {
	id = strings.ReplaceAll(id, "-", "")
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func truncateLabel(s string) string {
	s = strings.ToLower(s)
	if len(s) > 63 {
		return s[:63]
	}
	return s
}
