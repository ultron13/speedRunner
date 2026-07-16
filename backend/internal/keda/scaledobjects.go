package keda

import "fmt"

// Recommendation describes how many replicas KEDA should target.
type Recommendation struct {
	Component     string `json:"component"`
	MinReplicas   int32  `json:"minReplicas"`
	MaxReplicas   int32  `json:"maxReplicas"`
	Desired       int32  `json:"desired"`
	Metric        string `json:"metric"`
	TriggerValue  string `json:"triggerValue"`
	Reason        string `json:"reason"`
	ScaledObject  string `json:"scaledObjectYaml,omitempty"`
}

// Recommend returns scale recommendations based on pending runs and active VUs.
func Recommend(pendingRuns, activeRuns, activeVUs, queueDepth int) []Recommendation {
	// Controller workers: 1 worker per 5 pending runs
	ctrlDesired := int32(1 + pendingRuns/5)
	if ctrlDesired > 20 {
		ctrlDesired = 20
	}
	// Result ingestion: scale with active runs
	ingestDesired := int32(1)
	if activeRuns > 0 {
		ingestDesired = int32(activeRuns)
		if ingestDesired > 30 {
			ingestDesired = 30
		}
	}
	// Engine capacity hint (not pods — for KEDA queue trigger docs)
	engineHint := int32(0)
	if activeVUs > 0 {
		engineHint = int32((activeVUs + 49) / 50) // 50 VUs per worker pod
	}

	recs := []Recommendation{
		{
			Component: "controller-workers", MinReplicas: 1, MaxReplicas: 20, Desired: ctrlDesired,
			Metric: "pending_runs", TriggerValue: "5",
			Reason: fmt.Sprintf("%d pending runs", pendingRuns),
			ScaledObject: sampleScaledObject("controller-workers", "pending_runs", "5", 1, 20),
		},
		{
			Component: "result-ingestion", MinReplicas: 1, MaxReplicas: 30, Desired: ingestDesired,
			Metric: "active_runs", TriggerValue: "1",
			Reason: fmt.Sprintf("%d active runs", activeRuns),
			ScaledObject: sampleScaledObject("result-ingestion", "active_runs", "1", 1, 30),
		},
		{
			Component: "execution-workers", MinReplicas: 0, MaxReplicas: 100, Desired: engineHint,
			Metric: "active_vus", TriggerValue: "50",
			Reason: fmt.Sprintf("%d active VUs (≈%d pods @ 50 VU)", activeVUs, engineHint),
			ScaledObject: sampleScaledObject("execution-workers", "active_vus", "50", 0, 100),
		},
	}
	if queueDepth > 0 {
		recs = append(recs, Recommendation{
			Component: "notification-workers", MinReplicas: 1, MaxReplicas: 10,
			Desired: int32(1 + queueDepth/20),
			Metric: "queue_depth", TriggerValue: "20",
			Reason: fmt.Sprintf("queue depth %d", queueDepth),
		})
	}
	return recs
}

func sampleScaledObject(name, metric, threshold string, min, max int32) string {
	return fmt.Sprintf(`apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: speedrunner-%s
  namespace: marathonrunner-system
spec:
  scaleTargetRef:
    name: speedrunner-%s
  minReplicaCount: %d
  maxReplicaCount: %d
  triggers:
    - type: redis
      metadata:
        address: redis.marathonrunner-system:6379
        listName: speedrunner:%s
        listLength: "%s"
`, name, name, min, max, metric, threshold)
}
