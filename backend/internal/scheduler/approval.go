package scheduler

import (
	"fmt"
	"time"
)

// ApprovalStatus represents the status of an approval request
type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "PENDING"
	ApprovalApproved ApprovalStatus = "APPROVED"
	ApprovalRejected ApprovalStatus = "REJECTED"
	ApprovalExpired  ApprovalStatus = "EXPIRED"
)

// ApprovalRequest represents a request for test execution approval
type ApprovalRequest struct {
	ID           string
	RunID        string
	TestID       string
	RequestedBy  string
	RequestedAt  time.Time
	Status       ApprovalStatus
	ApprovedBy   string
	ApprovedAt   *time.Time
	RejectedBy   string
	RejectedAt   *time.Time
	ExpiresAt    time.Time
	Reason       string
	Notes        string
}

// ApprovalManager manages approval workflows
type ApprovalManager struct {
	requests map[string]*ApprovalRequest
}

// NewApprovalManager creates a new approval manager
func NewApprovalManager() *ApprovalManager {
	return &ApprovalManager{
		requests: make(map[string]*ApprovalRequest),
	}
}

// RequestApproval creates a new approval request
func (m *ApprovalManager) RequestApproval(request ApprovalRequest) *ApprovalRequest {
	request.Status = ApprovalPending
	request.RequestedAt = time.Now()
	if request.ExpiresAt.IsZero() {
		request.ExpiresAt = time.Now().Add(24 * time.Hour) // Default 24 hour expiry
	}

	m.requests[request.ID] = &request
	return &request
}

// Approve approves a pending request
func (m *ApprovalManager) Approve(requestID, approvedBy string, notes string) error {
	request, ok := m.requests[requestID]
	if !ok {
		return fmt.Errorf("approval request %s not found", requestID)
	}

	if request.Status != ApprovalPending {
		return fmt.Errorf("request %s is not pending (status: %s)", requestID, request.Status)
	}

	if time.Now().After(request.ExpiresAt) {
		request.Status = ApprovalExpired
		return fmt.Errorf("request %s has expired", requestID)
	}

	now := time.Now()
	request.Status = ApprovalApproved
	request.ApprovedBy = approvedBy
	request.ApprovedAt = &now
	request.Notes = notes

	return nil
}

// Reject rejects a pending request
func (m *ApprovalManager) Reject(requestID, rejectedBy string, reason string) error {
	request, ok := m.requests[requestID]
	if !ok {
		return fmt.Errorf("approval request %s not found", requestID)
	}

	if request.Status != ApprovalPending {
		return fmt.Errorf("request %s is not pending (status: %s)", requestID, request.Status)
	}

	now := time.Now()
	request.Status = ApprovalRejected
	request.RejectedBy = rejectedBy
	request.RejectedAt = &now
	request.Reason = reason

	return nil
}

// GetRequest returns an approval request by ID
func (m *ApprovalManager) GetRequest(requestID string) (*ApprovalRequest, bool) {
	request, ok := m.requests[requestID]
	return request, ok
}

// GetPendingRequests returns all pending approval requests
func (m *ApprovalManager) GetPendingRequests() []*ApprovalRequest {
	var pending []*ApprovalRequest
	for _, request := range m.requests {
		if request.Status == ApprovalPending {
			pending = append(pending, request)
		}
	}
	return pending
}

// IsApproved checks if a run is approved
func (m *ApprovalManager) IsApproved(runID string) bool {
	for _, request := range m.requests {
		if request.RunID == runID && request.Status == ApprovalApproved {
			return true
		}
	}
	return false
}
