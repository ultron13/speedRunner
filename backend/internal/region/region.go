package region

import (
	"fmt"
	"sync"
)

// Region describes a load-generation region.
type Region struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Code         string `json:"code"` // e.g. us-east-1
	Cluster      string `json:"cluster,omitempty"`
	Enabled      bool   `json:"enabled"`
	DataResidency string `json:"dataResidency,omitempty"`
	CapacityVUs  int    `json:"capacityVUs"`
	UsedVUs      int    `json:"usedVUs"`
}

// Registry holds multi-region execution clusters.
type Registry struct {
	mu      sync.RWMutex
	regions map[string]*Region
}

func NewRegistry() *Registry {
	r := &Registry{regions: make(map[string]*Region)}
	// Seed common default regions for local/dev
	r.Register(&Region{ID: "local", Name: "Local", Code: "local", Enabled: true, CapacityVUs: 10000})
	r.Register(&Region{ID: "us-east", Name: "US East", Code: "us-east-1", Enabled: true, CapacityVUs: 5000, DataResidency: "US"})
	r.Register(&Region{ID: "eu-west", Name: "EU West", Code: "eu-west-1", Enabled: true, CapacityVUs: 5000, DataResidency: "EU"})
	return r
}

func (r *Registry) Register(reg *Region) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.regions[reg.ID] = reg
}

func (r *Registry) List() []*Region {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Region, 0, len(r.regions))
	for _, reg := range r.regions {
		out = append(out, reg)
	}
	return out
}

func (r *Registry) Get(id string) (*Region, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	reg, ok := r.regions[id]
	return reg, ok
}

// Reserve attempts to reserve VUs capacity in a region.
func (r *Registry) Reserve(id string, vus int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	reg, ok := r.regions[id]
	if !ok {
		return fmt.Errorf("region %s not found", id)
	}
	if !reg.Enabled {
		return fmt.Errorf("region %s is disabled", id)
	}
	if reg.UsedVUs+vus > reg.CapacityVUs {
		return fmt.Errorf("region %s capacity exceeded (%d/%d)", id, reg.UsedVUs, reg.CapacityVUs)
	}
	reg.UsedVUs += vus
	return nil
}

// Release frees previously reserved VUs.
func (r *Registry) Release(id string, vus int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	reg, ok := r.regions[id]
	if !ok {
		return
	}
	reg.UsedVUs -= vus
	if reg.UsedVUs < 0 {
		reg.UsedVUs = 0
	}
}

// PickBest returns the enabled region with the most free capacity.
func (r *Registry) PickBest(neededVUs int) (*Region, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var best *Region
	bestFree := -1
	for _, reg := range r.regions {
		if !reg.Enabled {
			continue
		}
		free := reg.CapacityVUs - reg.UsedVUs
		if free >= neededVUs && free > bestFree {
			best = reg
			bestFree = free
		}
	}
	if best == nil {
		return nil, fmt.Errorf("no region with capacity for %d VUs", neededVUs)
	}
	return best, nil
}
