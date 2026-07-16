package scheduler

import (
	"fmt"
	"sync"
	"time"
)

// CapacityReservation represents a reserved capacity for a test run
type CapacityReservation struct {
	ID            string
	RunID         string
	VirtualUsers  int
	ReservedAt    time.Time
	ExpiresAt     time.Time
	Status        string
}

// CapacityManager manages capacity reservations
type CapacityManager struct {
	mu            sync.RWMutex
	reservations  map[string]*CapacityReservation
	maxCapacity   int
	currentUsage  int
}

// NewCapacityManager creates a new capacity manager
func NewCapacityManager(maxCapacity int) *CapacityManager {
	return &CapacityManager{
		reservations: make(map[string]*CapacityReservation),
		maxCapacity:  maxCapacity,
	}
}

// Reserve reserves capacity for a test run
func (m *CapacityManager) Reserve(reservation CapacityReservation) (*CapacityReservation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if there's enough capacity
	if m.currentUsage+reservation.VirtualUsers > m.maxCapacity {
		return nil, fmt.Errorf("insufficient capacity: requested %d, available %d",
			reservation.VirtualUsers, m.maxCapacity-m.currentUsage)
	}

	reservation.Status = "reserved"
	reservation.ReservedAt = time.Now()
	if reservation.ExpiresAt.IsZero() {
		reservation.ExpiresAt = time.Now().Add(time.Duration(reservation.VirtualUsers) * time.Minute)
	}

	m.reservations[reservation.ID] = &reservation
	m.currentUsage += reservation.VirtualUsers

	return &reservation, nil
}

// Release releases a reservation
func (m *CapacityManager) Release(reservationID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	reservation, ok := m.reservations[reservationID]
	if !ok {
		return fmt.Errorf("reservation %s not found", reservationID)
	}

	m.currentUsage -= reservation.VirtualUsers
	delete(m.reservations, reservationID)

	return nil
}

// GetAvailableCapacity returns the available capacity
func (m *CapacityManager) GetAvailableCapacity() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.maxCapacity - m.currentUsage
}

// GetUtilization returns the capacity utilization percentage
func (m *CapacityManager) GetUtilization() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return float64(m.currentUsage) / float64(m.maxCapacity) * 100
}

// CleanupExpired removes expired reservations
func (m *CapacityManager) CleanupExpired() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	cleaned := 0

	for id, reservation := range m.reservations {
		if now.After(reservation.ExpiresAt) {
			m.currentUsage -= reservation.VirtualUsers
			delete(m.reservations, id)
			cleaned++
		}
	}

	return cleaned
}
