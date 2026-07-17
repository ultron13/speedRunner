package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase8() {
	if s.Outbox == nil {
		s.Outbox = platform.NewOutbox()
	}
	if s.Idempotency == nil {
		s.Idempotency = platform.NewIdempotencyStore(24 * time.Hour)
	}
	if s.SoftDelete == nil {
		s.SoftDelete = platform.NewSoftDeleter()
	}
	if s.Circuit == nil {
		s.Circuit = platform.NewCircuitBreaker(5, 30*time.Second)
	}
	if s.FairQueue == nil {
		s.FairQueue = platform.NewFairQueue()
	}
	if s.UserPrefs == nil {
		s.UserPrefs = platform.NewUserPrefsStore()
	}
	if s.Org == nil {
		s.Org = platform.NewOrgStore()
	}
}

func (s *Server) outboxHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	if r.Method == http.MethodPost {
		var body struct {
			Type    string                 `json:"type"`
			Payload map[string]interface{} `json:"payload"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Type == "" {
			writeError(w, http.StatusBadRequest, "type required")
			return
		}
		ev := s.Outbox.Enqueue(uuid.New().String(), body.Type, body.Payload)
		writeJSON(w, http.StatusCreated, ev)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"pending": s.Outbox.Pending(),
	})
}

func (s *Server) webhookSignHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Secret    string `json:"secret"`
		Body      string `json:"body"`
		Signature string `json:"signature"`
		Action    string `json:"action"` // sign|verify
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Action == "verify" {
		writeJSON(w, http.StatusOK, map[string]bool{
			"valid": platform.VerifyWebhook(body.Secret, body.Body, body.Signature),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"signature": platform.SignWebhook(body.Secret, body.Body),
	})
}

func (s *Server) idempotencyHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	var body struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Key == "" {
		writeError(w, http.StatusBadRequest, "key required")
		return
	}
	first := s.Idempotency.First(body.Key)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"key":   body.Key,
		"first": first,
		"duplicate": !first,
	})
}

func (s *Server) softDeleteHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	var body struct {
		ID     string `json:"id"`
		Action string `json:"action"` // delete|restore|check
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	switch body.Action {
	case "restore":
		s.SoftDelete.Restore(body.ID)
	case "check":
		// fallthrough
	default:
		s.SoftDelete.Delete(body.ID)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      body.ID,
		"deleted": s.SoftDelete.IsDeleted(body.ID),
	})
}

func (s *Server) alertEvaluateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rule  platform.AlertRule `json:"rule"`
		Value float64            `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	fired, msg := platform.EvaluateAlert(body.Rule, body.Value)
	writeJSON(w, http.StatusOK, map[string]interface{}{"fired": fired, "message": msg})
}

func (s *Server) sloStatusHandler(w http.ResponseWriter, r *http.Request) {
	var slo platform.SLO
	if err := json.NewDecoder(r.Body).Decode(&slo); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.SLOStatus(slo))
}

func (s *Server) circuitBreakerHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	var body struct {
		Action string `json:"action"` // allow|success|failure|state
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	switch body.Action {
	case "success":
		s.Circuit.RecordSuccess()
	case "failure":
		s.Circuit.RecordFailure()
	case "allow":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"allow": s.Circuit.Allow(),
			"state": s.Circuit.State(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"state": s.Circuit.State()})
}

func (s *Server) watchdogHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DurationSec    int     `json:"durationSec"`
		MaxDurationSec int     `json:"maxDurationSec"`
		ErrorRate      float64 `json:"errorRate"`
		MaxErrorRate   float64 `json:"maxErrorRate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	stop, reason := platform.WatchdogShouldStop(body.DurationSec, body.MaxDurationSec, body.ErrorRate, body.MaxErrorRate)
	writeJSON(w, http.StatusOK, map[string]interface{}{"shouldStop": stop, "reason": reason})
}

func (s *Server) fairQueueHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	if r.Method == http.MethodPost {
		var body struct {
			Action string             `json:"action"` // enqueue|dequeue
			Run    platform.QueuedRun `json:"run"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Action == "dequeue" {
			item, ok := s.FairQueue.Dequeue()
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": ok, "run": item, "len": s.FairQueue.Len()})
			return
		}
		if body.Run.ID == "" {
			body.Run.ID = uuid.New().String()
		}
		s.FairQueue.Enqueue(body.Run)
		writeJSON(w, http.StatusCreated, map[string]interface{}{"run": body.Run, "len": s.FairQueue.Len()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"len": s.FairQueue.Len()})
}

func (s *Server) progressiveRampHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TargetVUs int `json:"targetVUs"`
		RampSec   int `json:"rampSec"`
		Steps     int `json:"steps"`
		Elapsed   int `json:"elapsedSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ramp := platform.BuildProgressiveRamp(body.TargetVUs, body.RampSec, body.Steps)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ramp":       ramp,
		"vusAtElapsed": platform.VUsAt(body.Elapsed, ramp),
	})
}

func (s *Server) budgetStatusHandler(w http.ResponseWriter, r *http.Request) {
	var b platform.Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.BudgetStatus(b))
}

func (s *Server) userPrefsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	uid := userIDFromContext(r.Context())
	if r.Method == http.MethodPost {
		var body struct {
			Kind     string                `json:"kind"` // search|bookmark
			Search   *platform.SavedSearch `json:"search"`
			Bookmark *platform.Bookmark    `json:"bookmark"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Kind == "bookmark" && body.Bookmark != nil {
			if body.Bookmark.ID == "" {
				body.Bookmark.ID = uuid.New().String()
			}
			if body.Bookmark.UserID == "" {
				body.Bookmark.UserID = uid
			}
			s.UserPrefs.AddBookmark(body.Bookmark)
			writeJSON(w, http.StatusCreated, body.Bookmark)
			return
		}
		if body.Search != nil {
			if body.Search.ID == "" {
				body.Search.ID = uuid.New().String()
			}
			if body.Search.UserID == "" {
				body.Search.UserID = uid
			}
			s.UserPrefs.SaveSearch(body.Search)
			writeJSON(w, http.StatusCreated, body.Search)
			return
		}
		writeError(w, http.StatusBadRequest, "search or bookmark required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"searches":  s.UserPrefs.ListSearches(uid),
		"bookmarks": s.UserPrefs.ListBookmarks(uid),
	})
}

func (s *Server) classifyDataHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.ClassifyData(body.Text))
}

func (s *Server) compliancePackHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RunIDs     []string `json:"runIds"`
		AuditCount int      `json:"auditCount"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusOK, platform.ComplianceEvidencePack(body.RunIDs, body.AuditCount))
}

func (s *Server) orgHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase8()
	if r.Method == http.MethodPost {
		var inv platform.Invite
		if err := json.NewDecoder(r.Body).Decode(&inv); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if inv.ID == "" {
			inv.ID = uuid.New().String()
		}
		s.Org.Invite(&inv)
		writeJSON(w, http.StatusCreated, inv)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"units":   s.Org.ListUnits(),
		"invites": s.Org.ListInvites(),
	})
}

func (s *Server) platformPhases8Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave":   "8",
		"count":  50,
		"phases": platform.Phase8Catalog(),
	})
}

// Combined phases 7–14 catalog
func (s *Server) platformAllPhasesHandler(w http.ResponseWriter, r *http.Request) {
	all, counts := platform.AllPhaseCatalogs()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"waves":        []string{"7", "8", "9", "10", "11", "12", "13", "14"},
		"count":        len(all),
		"phase7Count":  counts["7"],
		"phase8Count":  counts["8"],
		"phase9Count":  counts["9"],
		"phase10Count": counts["10"],
		"phase11Count": counts["11"],
		"phase12Count": counts["12"],
		"phase13Count": counts["13"],
		"phase14Count": counts["14"],
		"phases":       all,
	})
}
