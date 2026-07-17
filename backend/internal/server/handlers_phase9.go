package server

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase9() {
	if s.Synthetics == nil {
		s.Synthetics = platform.NewSyntheticStore()
	}
}

func (s *Server) regionFailoverHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Regions []platform.RegionHealth `json:"regions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Regions) == 0 {
		// seed defaults from registry if empty
		body.Regions = []platform.RegionHealth{
			{Name: "us-east-1", Healthy: true, LatencyMs: 35, ErrorRate: 0.2, CapacityVU: 2000, UsedVU: 400},
			{Name: "eu-west-1", Healthy: true, LatencyMs: 70, ErrorRate: 0.5, CapacityVU: 1500, UsedVU: 900},
			{Name: "ap-southeast-1", Healthy: true, LatencyMs: 120, ErrorRate: 1.0, CapacityVU: 1000, UsedVU: 300},
		}
	}
	writeJSON(w, http.StatusOK, platform.FailoverPlan(body.Regions))
}

func (s *Server) drEvaluateHandler(w http.ResponseWriter, r *http.Request) {
	var p platform.DRPolicy
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if p.Name == "" {
		p.Name = "default"
	}
	writeJSON(w, http.StatusOK, platform.EvaluateDR(p))
}

func (s *Server) traceSampleHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TraceID string  `json:"traceId"`
		Rate    float64 `json:"rate"`
		RunID   string  `json:"runId"`
		Traces  []platform.TraceSample `json:"traces"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Traces) > 0 {
		writeJSON(w, http.StatusOK, platform.CorrelateRunTraces(body.RunID, body.Traces))
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"traceId": body.TraceID,
		"sample":  platform.ShouldSample(body.TraceID, body.Rate),
		"rate":    body.Rate,
	})
}

func (s *Server) syntheticsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase9()
	if r.Method == http.MethodPost {
		var c platform.SyntheticCheck
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if c.ID == "" {
			c.ID = uuid.New().String()
		}
		if c.Name == "" {
			c.Name = c.ID
		}
		s.Synthetics.Upsert(c)
		writeJSON(w, http.StatusCreated, c)
		return
	}
	checks := s.Synthetics.List()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"checks":    checks,
		"summary":   platform.EvaluateSynthetic(checks, 0.2),
	})
}

func (s *Server) canaryAnalyzeHandler(w http.ResponseWriter, r *http.Request) {
	var snap platform.CanarySnapshot
	if err := json.NewDecoder(r.Body).Decode(&snap); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if snap.MinSample == 0 {
		snap.MinSample = 50
	}
	writeJSON(w, http.StatusOK, platform.AnalyzeCanary(snap))
}

func (s *Server) capacityPlanHandler(w http.ResponseWriter, r *http.Request) {
	var in platform.CapacityInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.PlanCapacity(in))
}

func (s *Server) exportBundleHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Tests  []map[string]interface{} `json:"tests"`
		SLA    []map[string]interface{} `json:"sla"`
		Flags  map[string]bool          `json:"flags"`
		Action string                   `json:"action"` // build|validate
		Bundle *platform.ExportBundle   `json:"bundle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Action == "validate" && body.Bundle != nil {
		ok, issues := platform.ValidateImportBundle(*body.Bundle)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": ok, "issues": issues})
		return
	}
	if body.Flags == nil {
		body.Flags = map[string]bool{}
	}
	writeJSON(w, http.StatusOK, platform.BuildExportBundle(body.Tests, body.SLA, body.Flags))
}

func (s *Server) rolloutHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Feature string `json:"feature"`
		Percent int    `json:"percent"`
		UserKey string `json:"userKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.UserKey == "" {
		body.UserKey = userIDFromContext(r.Context())
	}
	enabled := platform.RolloutEnabled(platform.Rollout{Feature: body.Feature, Percent: body.Percent}, body.UserKey)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"feature": body.Feature,
		"percent": body.Percent,
		"userKey": body.UserKey,
		"enabled": enabled,
	})
}

func (s *Server) platformPhases9Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave":   "9",
		"count":  50,
		"phases": platform.Phase9Catalog(),
	})
}
