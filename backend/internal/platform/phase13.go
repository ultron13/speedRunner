package platform

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Phase 13 — Edge/mobile load, FinOps carbon, partner connectors (13.1–13.50).

// ── 13.1–13.12 Edge & mobile load profiles ──────────────────────────────────

type EdgeLocation struct {
	ID       string  `json:"id"`
	City     string  `json:"city"`
	Country  string  `json:"country"`
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
	Provider string  `json:"provider"` // cloudflare|fastly|aws-cloudfront|custom
}

func DefaultEdgeLocations() []EdgeLocation {
	return []EdgeLocation{
		{ID: "edge-sfo", City: "San Francisco", Country: "US", Lat: 37.77, Lon: -122.42, Provider: "cloudflare"},
		{ID: "edge-fra", City: "Frankfurt", Country: "DE", Lat: 50.11, Lon: 8.68, Provider: "aws-cloudfront"},
		{ID: "edge-sin", City: "Singapore", Country: "SG", Lat: 1.35, Lon: 103.82, Provider: "fastly"},
		{ID: "edge-syd", City: "Sydney", Country: "AU", Lat: -33.87, Lon: 151.21, Provider: "cloudflare"},
	}
}

type MobileProfile struct {
	Name         string  `json:"name"`
	Network      string  `json:"network"` // 4g|5g|wifi|3g
	LatencyMs    float64 `json:"latencyMs"`
	BandwidthKbps float64 `json:"bandwidthKbps"`
	PacketLoss   float64 `json:"packetLossPct"`
	DeviceCPU    float64 `json:"deviceCpuFactor"` // 1.0 = desktop
}

func MobileProfiles() []MobileProfile {
	return []MobileProfile{
		{Name: "Desktop WiFi", Network: "wifi", LatencyMs: 20, BandwidthKbps: 50000, PacketLoss: 0, DeviceCPU: 1},
		{Name: "Mobile 5G", Network: "5g", LatencyMs: 25, BandwidthKbps: 100000, PacketLoss: 0.1, DeviceCPU: 0.7},
		{Name: "Mobile 4G", Network: "4g", LatencyMs: 50, BandwidthKbps: 15000, PacketLoss: 0.5, DeviceCPU: 0.6},
		{Name: "Mobile 3G", Network: "3g", LatencyMs: 150, BandwidthKbps: 1500, PacketLoss: 1.5, DeviceCPU: 0.4},
	}
}

func ApplyMobileNetwork(baseP95 float64, profile MobileProfile) float64 {
	// simplified: base + RTT contribution + bandwidth queueing heuristic
	return baseP95 + profile.LatencyMs*1.5 + (1000.0 / math.Max(profile.BandwidthKbps, 1) * 100)
}

// ── 13.13–13.24 FinOps & carbon scoring ─────────────────────────────────────

type FinOpsEstimate struct {
	VUHours       float64 `json:"vuHours"`
	ComputeUSD    float64 `json:"computeUsd"`
	NetworkUSD    float64 `json:"networkUsd"`
	StorageUSD    float64 `json:"storageUsd"`
	TotalUSD      float64 `json:"totalUsd"`
	CarbonKgCO2e  float64 `json:"carbonKgCo2e"`
	RegionFactor  float64 `json:"regionCarbonFactor"`
}

func EstimateFinOps(vus, durationSec int, region string, networkGB, storageGB float64) FinOpsEstimate {
	hours := float64(vus) * float64(durationSec) / 3600.0
	// rough unit costs
	compute := hours * 0.04
	network := networkGB * 0.09
	storage := storageGB * 0.023
	factor := regionCarbonFactor(region)
	// 0.0004 kg CO2e per VU-hour * regional grid factor
	carbon := hours * 0.0004 * factor
	return FinOpsEstimate{
		VUHours: hours, ComputeUSD: compute, NetworkUSD: network, StorageUSD: storage,
		TotalUSD: compute + network + storage, CarbonKgCO2e: carbon, RegionFactor: factor,
	}
}

func regionCarbonFactor(region string) float64 {
	r := strings.ToLower(region)
	switch {
	case strings.Contains(r, "eu-north"), strings.Contains(r, "stockholm"):
		return 0.3
	case strings.Contains(r, "eu-"), strings.Contains(r, "europe"):
		return 0.6
	case strings.Contains(r, "us-west"), strings.Contains(r, "oregon"):
		return 0.5
	case strings.Contains(r, "ap-"), strings.Contains(r, "asia"):
		return 0.9
	default:
		return 0.7
	}
}

func CarbonGrade(kg float64) string {
	switch {
	case kg < 0.1:
		return "A"
	case kg < 0.5:
		return "B"
	case kg < 2:
		return "C"
	case kg < 10:
		return "D"
	default:
		return "E"
	}
}

// ── 13.25–13.36 Partner connectors hub ──────────────────────────────────────

type Connector struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Category string            `json:"category"` // itsm|chat|ci|apm|vcs
	Status   string            `json:"status"`   // available|connected|error
	Config   map[string]string `json:"config,omitempty"`
}

type ConnectorHub struct {
	mu          sync.RWMutex
	connectors  map[string]*Connector
}

func NewConnectorHub() *ConnectorHub {
	h := &ConnectorHub{connectors: make(map[string]*Connector)}
	for _, c := range []Connector{
		{ID: "jira", Name: "Jira", Category: "itsm", Status: "available"},
		{ID: "servicenow", Name: "ServiceNow", Category: "itsm", Status: "available"},
		{ID: "slack", Name: "Slack", Category: "chat", Status: "available"},
		{ID: "teams", Name: "Microsoft Teams", Category: "chat", Status: "available"},
		{ID: "github", Name: "GitHub Actions", Category: "ci", Status: "available"},
		{ID: "jenkins", Name: "Jenkins", Category: "ci", Status: "available"},
		{ID: "datadog", Name: "Datadog", Category: "apm", Status: "available"},
		{ID: "newrelic", Name: "New Relic", Category: "apm", Status: "available"},
		{ID: "gitlab", Name: "GitLab", Category: "vcs", Status: "available"},
	} {
		cc := c
		h.connectors[c.ID] = &cc
	}
	return h
}

func (h *ConnectorHub) List(category string) []*Connector {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]*Connector, 0)
	for _, c := range h.connectors {
		if category != "" && !strings.EqualFold(c.Category, category) {
			continue
		}
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (h *ConnectorHub) Connect(id string, cfg map[string]string) (*Connector, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.connectors[id]
	if !ok {
		return nil, fmt.Errorf("unknown connector")
	}
	c.Status = "connected"
	c.Config = cfg
	return c, nil
}

func (h *ConnectorHub) Disconnect(id string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.connectors[id]
	if !ok {
		return fmt.Errorf("unknown connector")
	}
	c.Status = "available"
	c.Config = nil
	return nil
}

// ── 13.37–13.44 Webhook delivery ledger & retry ─────────────────────────────

type DeliveryAttempt struct {
	ID         string    `json:"id"`
	Target     string    `json:"target"`
	EventType  string    `json:"eventType"`
	StatusCode int       `json:"statusCode"`
	Success    bool      `json:"success"`
	Attempts   int       `json:"attempts"`
	At         time.Time `json:"at"`
}

type DeliveryLedger struct {
	mu   sync.Mutex
	rows []DeliveryAttempt
}

func NewDeliveryLedger() *DeliveryLedger {
	return &DeliveryLedger{rows: make([]DeliveryAttempt, 0)}
}

func (d *DeliveryLedger) Record(a DeliveryAttempt) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if a.At.IsZero() {
		a.At = time.Now().UTC()
	}
	d.rows = append(d.rows, a)
	if len(d.rows) > 5000 {
		d.rows = d.rows[len(d.rows)-5000:]
	}
}

func (d *DeliveryLedger) Recent(limit int) []DeliveryAttempt {
	d.mu.Lock()
	defer d.mu.Unlock()
	if limit <= 0 || limit > len(d.rows) {
		limit = len(d.rows)
	}
	start := len(d.rows) - limit
	out := make([]DeliveryAttempt, limit)
	copy(out, d.rows[start:])
	return out
}

func ShouldRetryDelivery(statusCode, attempts, maxAttempts int) bool {
	if attempts >= maxAttempts {
		return false
	}
	return statusCode == 0 || statusCode == 429 || statusCode >= 500
}

// ── 13.45–13.49 Sustainability report ───────────────────────────────────────

func SustainabilityReport(estimates []FinOpsEstimate) map[string]interface{} {
	var totalUSD, totalC, totalVU float64
	for _, e := range estimates {
		totalUSD += e.TotalUSD
		totalC += e.CarbonKgCO2e
		totalVU += e.VUHours
	}
	return map[string]interface{}{
		"totalUsd":       totalUSD,
		"totalCarbonKg":  totalC,
		"totalVuHours":   totalVU,
		"carbonGrade":    CarbonGrade(totalC),
		"recommendation": carbonAdvice(totalC),
		"count":          len(estimates),
	}
}

func carbonAdvice(kg float64) string {
	switch CarbonGrade(kg) {
	case "A", "B":
		return "Carbon footprint is efficient — prefer low-carbon regions for large suites"
	case "C":
		return "Consider off-peak scheduling and greener regions (eu-north, us-west)"
	default:
		return "High carbon cost — reduce VU-hours, use spot capacity, consolidate runs"
	}
}

// ── 13.50 Catalog ───────────────────────────────────────────────────────────

func Phase13Catalog() []map[string]string {
	names := []string{
		"Edge location model", "Default edge POPs", "Edge provider field", "Mobile profile model", "Mobile 5G profile",
		"Mobile 4G profile", "Mobile 3G profile", "Desktop wifi profile", "Apply mobile network p95", "Bandwidth heuristic",
		"Packet loss field", "Device CPU factor", "FinOps estimate model", "VU-hours calc", "Compute cost",
		"Network cost", "Storage cost", "Total USD", "Carbon kg CO2e", "Region carbon factor EU",
		"Region carbon factor APAC", "Carbon grade A-E", "Low carbon advice", "High carbon advice", "Connector hub seed",
		"Connector list filter", "Connector connect", "Connector disconnect", "Jira connector", "Slack connector",
		"GitHub Actions connector", "Datadog connector", "Delivery attempt model", "Delivery ledger record", "Delivery recent",
		"Retry on 5xx", "Retry on 429", "No retry max attempts", "Sustainability report", "Report carbon grade",
		"Report recommendation", "Edge geo distribution", "Mobile + edge combine", "Partner hub status", "FinOps dashboard data",
		"Green region pick", "Webhook reliability", "Enterprise connector pack", "Sustainability KPI", "Phase 13 catalog",
	}
	items := make([]map[string]string, 0, 50)
	for i, n := range names {
		items = append(items, map[string]string{"id": fmt.Sprintf("13.%d", i+1), "name": n})
	}
	return items
}

// AllPhaseCatalogs merges waves 7–13 for /platform/phases/all.
func AllPhaseCatalogs() (all []map[string]string, counts map[string]int) {
	p7 := PhaseCatalog()
	p8 := Phase8Catalog()
	p9 := Phase9Catalog()
	p10 := Phase10Catalog()
	p11 := Phase11Catalog()
	p12 := Phase12Catalog()
	p13 := Phase13Catalog()
	all = make([]map[string]string, 0, 350)
	all = append(all, p7...)
	all = append(all, p8...)
	all = append(all, p9...)
	all = append(all, p10...)
	all = append(all, p11...)
	all = append(all, p12...)
	all = append(all, p13...)
	counts = map[string]int{
		"7": len(p7), "8": len(p8), "9": len(p9), "10": len(p10),
		"11": len(p11), "12": len(p12), "13": len(p13),
	}
	return all, counts
}
