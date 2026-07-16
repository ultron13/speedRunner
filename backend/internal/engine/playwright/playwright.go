package playwright

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

// Engine runs browser-level performance checks via Playwright in a K8s Job.
type Engine struct {
	clientset kubernetes.Interface
	namespace string
	image     string
}

func New(clientset kubernetes.Interface, namespace, image string) *Engine {
	if image == "" {
		image = "mcr.microsoft.com/playwright:v1.40.0-jammy"
	}
	return &Engine{clientset: clientset, namespace: namespace, image: image}
}

func (e *Engine) Name() string { return "playwright" }

func (e *Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	result := &engine.ExecutionResult{RunID: req.RunID, Status: "RUNNING", StartedAt: time.Now()}
	ns := req.Namespace
	if ns == "" {
		ns = e.namespace
	}
	labels := map[string]string{
		"app": "playwright", "run-id": shortID(req.RunID), "engine": "playwright",
		"app.kubernetes.io/part-of": "speedrunner", "app.kubernetes.io/component": "execution",
	}
	script := fmt.Sprintf(`const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const start = Date.now();
  await page.goto('%s', { waitUntil: 'networkidle' });
  const timing = await page.evaluate(() => JSON.stringify(performance.timing));
  console.log(JSON.stringify({ durationMs: Date.now() - start, timing: JSON.parse(timing) }));
  await browser.close();
})();
`, req.TargetURL)

	cmName := fmt.Sprintf("pw-script-%s", shortID(req.RunID))
	jobName := fmt.Sprintf("pw-%s", shortID(req.RunID))
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: cmName, Namespace: ns, Labels: labels},
		Data:       map[string]string{"test.js": script},
	}
	if _, err := e.clientset.CoreV1().ConfigMaps(ns).Create(ctx, cm, metav1.CreateOptions{}); err != nil {
		result.Status = "FAILED"
		result.Error = err
		return result, err
	}
	backoff, ttl := int32(0), int32(600)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: ns, Labels: labels},
		Spec: batchv1.JobSpec{
			BackoffLimit: &backoff, TTLSecondsAfterFinished: &ttl,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{{
						Name:    "playwright",
						Image:   e.image,
						Command: []string{"node", "/scripts/test.js"},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("500m"), corev1.ResourceMemory: resource.MustParse("1Gi")},
							Limits:   corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("2"), corev1.ResourceMemory: resource.MustParse("2Gi")},
						},
						VolumeMounts: []corev1.VolumeMount{{Name: "scripts", MountPath: "/scripts", ReadOnly: true}},
					}},
					Volumes: []corev1.Volume{
						{Name: "scripts", VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: cmName}}}},
					},
				},
			},
		},
	}
	if _, err := e.clientset.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{}); err != nil {
		_ = e.clientset.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
		result.Status = "FAILED"
		result.Error = err
		return result, err
	}
	return result, nil
}

func (e *Engine) GetStatus(ctx context.Context, runID string) (string, error) {
	job, err := e.clientset.BatchV1().Jobs(e.namespace).Get(ctx, fmt.Sprintf("pw-%s", shortID(runID)), metav1.GetOptions{})
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

func (e *Engine) Cleanup(ctx context.Context, runID string) error {
	prop := metav1.DeletePropagationBackground
	_ = e.clientset.BatchV1().Jobs(e.namespace).Delete(ctx, fmt.Sprintf("pw-%s", shortID(runID)), metav1.DeleteOptions{PropagationPolicy: &prop})
	_ = e.clientset.CoreV1().ConfigMaps(e.namespace).Delete(ctx, fmt.Sprintf("pw-script-%s", shortID(runID)), metav1.DeleteOptions{})
	return nil
}

func shortID(id string) string {
	id = strings.ReplaceAll(id, "-", "")
	if len(id) > 12 {
		return id[:12]
	}
	return id
}
