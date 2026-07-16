package cost

import (
	"fmt"
	"math"
)

// ResourceRates defines per-unit costs for chargeback estimation.
type ResourceRates struct {
	// CPUHourCost is USD per vCPU-hour
	CPUHourCost float64
	// MemoryGBHourCost is USD per GB-hour
	MemoryGBHourCost float64
	// NetworkGBCost is USD per GB transferred
	NetworkGBCost float64
	// StorageGBMonthCost is USD per GB-month for artifacts
	StorageGBMonthCost float64
}

// DefaultRates returns conservative public-cloud-like defaults for estimation.
func DefaultRates() ResourceRates {
	return ResourceRates{
		CPUHourCost:        0.04,
		MemoryGBHourCost:   0.005,
		NetworkGBCost:      0.09,
		StorageGBMonthCost: 0.023,
	}
}

// EstimateInput describes resources used (or projected) for a run.
type EstimateInput struct {
	VirtualUsers   int
	DurationSec    int
	Engine         string
	CPUPerWorker   float64 // default 0.25
	MemoryGBWorker float64 // default 0.5
	Workers        int     // 0 = derive from VUs
	NetworkGB      float64
	ArtifactGB     float64
}

// Estimate is a cost breakdown for a single run.
type Estimate struct {
	Currency      string  `json:"currency"`
	ComputeUSD    float64 `json:"computeUsd"`
	NetworkUSD    float64 `json:"networkUsd"`
	StorageUSD    float64 `json:"storageUsd"`
	TotalUSD      float64 `json:"totalUsd"`
	Workers       int     `json:"workers"`
	CPUHours      float64 `json:"cpuHours"`
	MemoryGBHours float64 `json:"memoryGbHours"`
	Notes         string  `json:"notes"`
}

// Estimator computes run cost estimates.
type Estimator struct {
	Rates ResourceRates
}

func NewEstimator(rates ResourceRates) *Estimator {
	return &Estimator{Rates: rates}
}

func NewDefault() *Estimator {
	return NewEstimator(DefaultRates())
}

// Estimate projects cost for a run configuration.
func (e *Estimator) Estimate(in EstimateInput) Estimate {
	cpuPer := in.CPUPerWorker
	if cpuPer <= 0 {
		cpuPer = 0.25
	}
	memPer := in.MemoryGBWorker
	if memPer <= 0 {
		memPer = 0.5
	}
	workers := in.Workers
	if workers <= 0 {
		// Rough: 50 VUs per worker for distributed engines
		workers = int(math.Max(1, math.Ceil(float64(in.VirtualUsers)/50)))
	}
	durH := float64(in.DurationSec) / 3600.0
	if durH <= 0 {
		durH = 1.0 / 60.0 // minimum 1 minute
	}

	cpuHours := float64(workers) * cpuPer * durH
	memHours := float64(workers) * memPer * durH

	compute := cpuHours*e.Rates.CPUHourCost + memHours*e.Rates.MemoryGBHourCost
	network := in.NetworkGB * e.Rates.NetworkGBCost
	// Prorate monthly storage to run duration (hours / 730)
	storage := in.ArtifactGB * e.Rates.StorageGBMonthCost * (durH / 730.0)

	total := compute + network + storage

	return Estimate{
		Currency:      "USD",
		ComputeUSD:    round4(compute),
		NetworkUSD:    round4(network),
		StorageUSD:    round4(storage),
		TotalUSD:      round4(total),
		Workers:       workers,
		CPUHours:      round4(cpuHours),
		MemoryGBHours: round4(memHours),
		Notes:         fmt.Sprintf("estimate for %s engine; not a bill — governance may override schedule recommendations", in.Engine),
	}
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
