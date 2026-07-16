package server

import (
	"net/http"
	"time"
)

// listExecutionJobsHandler returns active Kubernetes execution jobs (when K8s is configured).
func (s *Server) listExecutionJobsHandler(w http.ResponseWriter, r *http.Request) {
	if s.K8s == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"jobs":    []interface{}{},
			"k8s":     false,
			"message": "kubernetes client not configured",
		})
		return
	}

	ns := s.K8s.Namespace
	if s.Config != nil && s.Config.K8s.ExecutionNS != "" {
		ns = s.Config.K8s.ExecutionNS
	}

	jobs, err := s.K8s.ListJobs(r.Context(), ns, "app.kubernetes.io/part-of=speedrunner")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list execution jobs: "+err.Error())
		return
	}

	out := make([]map[string]interface{}, 0, len(jobs))
	for _, j := range jobs {
		status := "PENDING"
		if j.Status.Succeeded > 0 {
			status = "COMPLETED"
		} else if j.Status.Failed > 0 {
			status = "FAILED"
		} else if j.Status.Active > 0 {
			status = "RUNNING"
		}
		labels := j.Labels
		if labels == nil {
			labels = map[string]string{}
		}
		out = append(out, map[string]interface{}{
			"name":      j.Name,
			"namespace": j.Namespace,
			"status":    status,
			"active":    j.Status.Active,
			"succeeded": j.Status.Succeeded,
			"failed":    j.Status.Failed,
			"runId":     labels["run-id"],
			"testId":    labels["test-id"],
			"engine":    labels["engine"],
			"createdAt": j.CreationTimestamp.Time.Format(time.RFC3339),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"jobs":      out,
		"k8s":       true,
		"namespace": ns,
		"total":     len(out),
	})
}
