package engine

import (
	"context"
	"fmt"
	"time"
)

// Engine defines the interface for test execution engines
type Engine interface {
	Name() string
	Execute(ctx context.Context, req ExecutionRequest) (*ExecutionResult, error)
	GetStatus(ctx context.Context, runID string) (string, error)
	Cleanup(ctx context.Context, runID string) error
}

type ExecutionRequest struct {
	RunID        string
	TestID       string
	TargetURL    string
	VirtualUsers int
	Duration     int
	RampUp       int
	TestPlanPath string
	Namespace    string
	Labels       map[string]string
}

type ExecutionResult struct {
	RunID         string
	Status        string
	StartedAt     time.Time
	CompletedAt   *time.Time
	Duration      float64
	Throughput    float64
	AvgRespTime   float64
	P50           float64
	P90           float64
	P95           float64
	P99           float64
	ErrorRate     float64
	ResultPath    string
	LogPath       string
	Error         error
}

type EngineType struct {
	Name              string
	Image             string
	Version           string
	Command           []string
	ResultFormat      string
	ScaleModel        string
	SupportedControls []string
}

// Registry holds all available engines
type Registry struct {
	engines map[string]Engine
}

func NewRegistry() *Registry {
	return &Registry{
		engines: make(map[string]Engine),
	}
}

func (r *Registry) Register(e Engine) {
	r.engines[e.Name()] = e
}

func (r *Registry) Get(name string) (Engine, error) {
	e, ok := r.engines[name]
	if !ok {
		return nil, fmt.Errorf("engine %s not found", name)
	}
	return e, nil
}

func (r *Registry) List() []string {
	var names []string
	for name := range r.engines {
		names = append(names, name)
	}
	return names
}
