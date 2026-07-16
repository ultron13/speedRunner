package k8s

import (
	"context"
	"fmt"
	"io"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PodInfo contains information about a pod
type PodInfo struct {
	Name      string
	Namespace string
	Status    string
	Ready     bool
	IP        string
	NodeName  string
	Labels    map[string]string
}

// GetPod retrieves a pod by name
func (c *Client) GetPod(ctx context.Context, name, namespace string) (*corev1.Pod, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	pod, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod %s: %w", name, err)
	}

	return pod, nil
}

// ListPods lists pods with a label selector
func (c *Client) ListPods(ctx context.Context, namespace, labelSelector string) ([]corev1.Pod, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	pods, err := c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	return pods.Items, nil
}

// GetPodLogs retrieves logs from a pod
func (c *Client) GetPodLogs(ctx context.Context, name, namespace, container string) (string, error) {
	if namespace == "" {
		namespace = c.Namespace
	}

	req := c.Clientset.CoreV1().Pods(namespace).GetLogs(name, &corev1.PodLogOptions{
		Container: container,
	})

	stream, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get pod logs: %w", err)
	}
	defer stream.Close()

	bytes, err := io.ReadAll(stream)
	if err != nil {
		return "", fmt.Errorf("failed to read pod logs: %w", err)
	}

	return string(bytes), nil
}

// DeletePod deletes a pod
func (c *Client) DeletePod(ctx context.Context, name, namespace string) error {
	if namespace == "" {
		namespace = c.Namespace
	}

	err := c.Clientset.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete pod %s: %w", name, err)
	}

	return nil
}

// GetPodInfo returns simplified pod information
func (c *Client) GetPodInfo(pod *corev1.Pod) PodInfo {
	ready := false
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			ready = true
			break
		}
	}

	return PodInfo{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Status:    string(pod.Status.Phase),
		Ready:     ready,
		IP:        pod.Status.PodIP,
		NodeName:  pod.Spec.NodeName,
		Labels:    pod.Labels,
	}
}
