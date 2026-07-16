package engine

// Definition describes a load-generation engine for the catalog API and operator.
type Definition struct {
	Name              string   `json:"name"`
	DisplayName       string   `json:"displayName"`
	Image             string   `json:"image"`
	Version           string   `json:"version"`
	ResultFormat      string   `json:"resultFormat"`
	ScaleModel        string   `json:"scaleModel"` // job | distributed | inprocess
	SupportedControls []string `json:"supportedControls"`
	Inputs            []string `json:"inputs"`
	Outputs           []string `json:"outputs"`
	Available         bool     `json:"available"`
}

// Catalog returns built-in engine definitions. Availability is filled by the server.
func Catalog() []Definition {
	return []Definition{
		{
			Name: "simulate", DisplayName: "Simulator", Image: "in-process",
			Version: "1.0", ResultFormat: "json", ScaleModel: "inprocess",
			SupportedControls: []string{"start", "stop"},
			Inputs:            []string{"targetUrl", "virtualUsers", "duration"},
			Outputs:           []string{"metrics", "percentiles"},
			Available:         true,
		},
		{
			Name: "http", DisplayName: "HTTP Engine", Image: "in-process",
			Version: "1.0", ResultFormat: "json", ScaleModel: "inprocess",
			SupportedControls: []string{"start", "stop"},
			Inputs:            []string{"targetUrl", "virtualUsers", "duration"},
			Outputs:           []string{"metrics"},
			Available:         true,
		},
		{
			Name: "jmeter", DisplayName: "Apache JMeter", Image: "apache/jmeter:5.6.3",
			Version: "5.6.3", ResultFormat: "jtl", ScaleModel: "job",
			SupportedControls: []string{"start", "stop", "distributed"},
			Inputs:            []string{"testPlan", "targetUrl", "virtualUsers", "duration", "rampUp"},
			Outputs:           []string{"jtl", "htmlReport", "logs"},
		},
		{
			Name: "k6", DisplayName: "Grafana k6", Image: "grafana/k6:latest",
			Version: "latest", ResultFormat: "json", ScaleModel: "job",
			SupportedControls: []string{"start", "stop"},
			Inputs:            []string{"script", "targetUrl", "virtualUsers", "duration"},
			Outputs:           []string{"summaryJson", "metrics"},
		},
		{
			Name: "gatling", DisplayName: "Gatling", Image: "denvazh/gatling:latest",
			Version: "3.10", ResultFormat: "simulation-log", ScaleModel: "job",
			SupportedControls: []string{"start", "stop"},
			Inputs:            []string{"simulation", "targetUrl", "virtualUsers", "duration"},
			Outputs:           []string{"simulationLog", "htmlReport"},
		},
		{
			Name: "locust", DisplayName: "Locust", Image: "locustio/locust:latest",
			Version: "2.x", ResultFormat: "csv", ScaleModel: "distributed",
			SupportedControls: []string{"start", "stop", "master-worker"},
			Inputs:            []string{"locustfile", "targetUrl", "virtualUsers", "spawnRate"},
			Outputs:           []string{"csv", "html"},
		},
		{
			Name: "playwright", DisplayName: "Playwright Browser", Image: "mcr.microsoft.com/playwright:v1.40.0-jammy",
			Version: "1.40", ResultFormat: "json", ScaleModel: "job",
			SupportedControls: []string{"start", "stop"},
			Inputs:            []string{"script", "targetUrl", "browsers", "virtualUsers"},
			Outputs:           []string{"trace", "video", "metrics"},
		},
	}
}
