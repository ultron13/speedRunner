package jmeter

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type JMeterEngine struct {
	clientset kubernetes.Interface
	namespace string
	image     string
}

func New(clientset kubernetes.Interface, namespace, image string) *JMeterEngine {
	if image == "" {
		image = "apache/jmeter:5.6.3"
	}
	return &JMeterEngine{
		clientset: clientset,
		namespace: namespace,
		image:     image,
	}
}

func (e *JMeterEngine) Name() string { return "jmeter" }

func (e *JMeterEngine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
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
		"app":                          "jmeter",
		"run-id":                       truncateLabel(req.RunID),
		"test-id":                      truncateLabel(req.TestID),
		"app.kubernetes.io/part-of":    "speedrunner",
		"app.kubernetes.io/component":  "execution",
		"app.kubernetes.io/managed-by": "speedrunner-backend",
	}
	for k, v := range req.Labels {
		labels[k] = truncateLabel(v)
	}

	domain, path, protocol := splitURL(req.TargetURL)
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

	jmx := GenerateTestPlan(TestPlanConfig{
		TargetURL:    req.TargetURL,
		VirtualUsers: vus,
		Duration:     duration,
		RampUp:       rampUp,
		Protocol:     protocol,
		HTTPMethod:   "GET",
		Domain:       domain,
		Path:         path,
	})

	cmName := fmt.Sprintf("jmeter-plan-%s", shortID(req.RunID))
	jobName := fmt.Sprintf("jmeter-%s", shortID(req.RunID))

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: ns,
			Labels:    labels,
		},
		Data: map[string]string{
			"test-plan.jmx": jmx,
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
							Name:  "jmeter",
							Image: e.image,
							Command: []string{
								"/bin/sh", "-c",
								"jmeter -n -t /test-plan/test-plan.jmx -l /results/results.jtl -j /results/jmeter.log -e -o /results/report || true",
							},
							Env: []corev1.EnvVar{
								{Name: "RUN_ID", Value: req.RunID},
								{Name: "TARGET_URL", Value: req.TargetURL},
								{Name: "VIRTUAL_USERS", Value: fmt.Sprintf("%d", vus)},
								{Name: "DURATION", Value: fmt.Sprintf("%d", duration)},
								{Name: "RAMP_UP", Value: fmt.Sprintf("%d", rampUp)},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("250m"),
									corev1.ResourceMemory: resource.MustParse("512Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("1"),
									corev1.ResourceMemory: resource.MustParse("1Gi"),
								},
							},
							VolumeMounts: []corev1.VolumeMount{
								{Name: "test-plan", MountPath: "/test-plan", ReadOnly: true},
								{Name: "results", MountPath: "/results"},
							},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "test-plan",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: cmName},
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

	_, err = e.clientset.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		_ = e.clientset.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
		result.Status = "FAILED"
		result.Error = fmt.Errorf("failed to create job: %w", err)
		return result, result.Error
	}

	return result, nil
}

func (e *JMeterEngine) GetStatus(ctx context.Context, runID string) (string, error) {
	jobName := fmt.Sprintf("jmeter-%s", shortID(runID))
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

func (e *JMeterEngine) Cleanup(ctx context.Context, runID string) error {
	jobName := fmt.Sprintf("jmeter-%s", shortID(runID))
	cmName := fmt.Sprintf("jmeter-plan-%s", shortID(runID))
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

func splitURL(raw string) (domain, path, protocol string) {
	protocol = "https"
	path = "/"
	domain = raw
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		u, err = url.Parse("https://" + raw)
		if err != nil {
			return raw, "/", "https"
		}
	}
	if u.Scheme != "" {
		protocol = u.Scheme
	}
	domain = u.Hostname()
	if u.Port() != "" {
		domain = domain + ":" + u.Port()
	}
	if u.Path != "" {
		path = u.Path
	}
	if u.RawQuery != "" {
		path = path + "?" + u.RawQuery
	}
	return domain, path, protocol
}
