package jmeter

import (
	"context"
	"fmt"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
)

type JMeterEngine struct {
	clientset kubernetes.Interface
	namespace string
	image     string
}

func New(clientset kubernetes.Interface, namespace, image string) *JMeterEngine {
	return &JMeterEngine{
		clientset: clientset,
		namespace: namespace,
		image:     image,
	}
}

func (e *JMeterEngine) Name() string {
	return "jmeter"
}

func (e *JMeterEngine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	result := &engine.ExecutionResult{
		RunID:     req.RunID,
		Status:    "RUNNING",
		StartedAt: time.Now(),
	}

	labels := map[string]string{
		"app":                          "jmeter",
		"run-id":                       req.RunID,
		"test-id":                      req.TestID,
		"app.kubernetes.io/part-of":    "speedrunner",
		"app.kubernetes.io/component":  "execution",
		"app.kubernetes.io/managed-by": "speedrunner-backend",
	}
	for k, v := range req.Labels {
		labels[k] = v
	}

	// Create ConfigMap for test plan
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("jmeter-test-plan-%s", req.RunID),
			Namespace: e.namespace,
			Labels:    labels,
		},
		Data: map[string]string{
			"test-plan.jmx": fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="MarathonRunner Test" enabled="true">
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Load Test" enabled="true">
        <intProp name="ThreadGroup.num_threads">%d</intProp>
        <intProp name="ThreadGroup.ramp_time">%d</intProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <stringProp name="ThreadGroup.duration">%d</stringProp>
        <stringProp name="ThreadGroup.delay">0</stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="HTTP Request" enabled="true">
          <stringProp name="HTTPSampler.domain">%s</stringProp>
          <stringProp name="HTTPSampler.path">/</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
        </HTTPSamplerProxy>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`, req.VirtualUsers, req.RampUp, req.Duration, req.TargetURL),
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
			Name:      fmt.Sprintf("jmeter-%s", req.RunID),
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
							Name:  "jmeter",
							Image: e.image,
							Env: []corev1.EnvVar{
								{Name: "RUN_ID", Value: req.RunID},
								{Name: "TARGET_URL", Value: req.TargetURL},
								{Name: "VIRTUAL_USERS", Value: fmt.Sprintf("%d", req.VirtualUsers)},
								{Name: "DURATION", Value: fmt.Sprintf("%d", req.Duration)},
								{Name: "RAMP_UP", Value: fmt.Sprintf("%d", req.RampUp)},
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
								{Name: "test-plan", MountPath: "/test-plan", ReadOnly: true},
								{Name: "results", MountPath: "/results"},
							},
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
					Volumes: []corev1.Volume{
						{
							Name: "test-plan",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: fmt.Sprintf("jmeter-test-plan-%s", req.RunID),
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

func (e *JMeterEngine) GetStatus(ctx context.Context, runID string) (string, error) {
	job, err := e.clientset.BatchV1().Jobs(e.namespace).Get(ctx, fmt.Sprintf("jmeter-%s", runID), metav1.GetOptions{})
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
	jobName := fmt.Sprintf("jmeter-%s", runID)
	configMapName := fmt.Sprintf("jmeter-test-plan-%s", runID)

	_ = e.clientset.BatchV1().Jobs(e.namespace).Delete(ctx, jobName, metav1.DeleteOptions{})
	_ = e.clientset.CoreV1().ConfigMaps(e.namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	return nil
}
