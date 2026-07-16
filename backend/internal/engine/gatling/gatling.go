package gatling

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

// Engine launches Gatling as a Kubernetes Job.
type Engine struct {
	clientset kubernetes.Interface
	namespace string
	image     string
}

func New(clientset kubernetes.Interface, namespace, image string) *Engine {
	if image == "" {
		image = "denvazh/gatling:latest"
	}
	return &Engine{clientset: clientset, namespace: namespace, image: image}
}

func (e *Engine) Name() string { return "gatling" }

func (e *Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	result := &engine.ExecutionResult{RunID: req.RunID, Status: "RUNNING", StartedAt: time.Now()}
	ns := req.Namespace
	if ns == "" {
		ns = e.namespace
	}
	labels := map[string]string{
		"app": "gatling", "run-id": shortID(req.RunID), "test-id": shortID(req.TestID),
		"app.kubernetes.io/part-of": "speedrunner", "app.kubernetes.io/component": "execution",
		"engine": "gatling",
	}
	sim := fmt.Sprintf(`
package speedrunner
import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._
class LoadSim extends Simulation {
  val httpProtocol = http.baseUrl("%s")
  val scn = scenario("SpeedRunner").exec(http("req").get("/"))
  setUp(scn.inject(rampUsers(%d) during (%d seconds))).protocols(httpProtocol)
}
`, strings.TrimRight(req.TargetURL, "/"), max(1, req.VirtualUsers), max(30, req.Duration))

	cmName := fmt.Sprintf("gatling-sim-%s", shortID(req.RunID))
	jobName := fmt.Sprintf("gatling-%s", shortID(req.RunID))
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: cmName, Namespace: ns, Labels: labels},
		Data:       map[string]string{"LoadSim.scala": sim},
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
						Name:  "gatling",
						Image: e.image,
						Command: []string{"/bin/bash", "-c",
							"cp /simulations/LoadSim.scala /opt/gatling/user-files/simulations/ && gatling.sh -s speedrunner.LoadSim -rf /results"},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("250m"), corev1.ResourceMemory: resource.MustParse("512Mi")},
							Limits:   corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("1"), corev1.ResourceMemory: resource.MustParse("1Gi")},
						},
						VolumeMounts: []corev1.VolumeMount{
							{Name: "sim", MountPath: "/simulations", ReadOnly: true},
							{Name: "results", MountPath: "/results"},
						},
					}},
					Volumes: []corev1.Volume{
						{Name: "sim", VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: cmName}}}},
						{Name: "results", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}}},
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
	job, err := e.clientset.BatchV1().Jobs(e.namespace).Get(ctx, fmt.Sprintf("gatling-%s", shortID(runID)), metav1.GetOptions{})
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
	_ = e.clientset.BatchV1().Jobs(e.namespace).Delete(ctx, fmt.Sprintf("gatling-%s", shortID(runID)), metav1.DeleteOptions{PropagationPolicy: &prop})
	_ = e.clientset.CoreV1().ConfigMaps(e.namespace).Delete(ctx, fmt.Sprintf("gatling-sim-%s", shortID(runID)), metav1.DeleteOptions{})
	return nil
}

func shortID(id string) string {
	id = strings.ReplaceAll(id, "-", "")
	if len(id) > 12 {
		return id[:12]
	}
	return id
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
