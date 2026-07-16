package gitops

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// TestManifest is a GitOps-friendly versioned test definition.
type TestManifest struct {
	APIVersion string `json:"apiVersion" yaml:"apiVersion"`
	Kind       string `json:"kind" yaml:"kind"`
	Metadata   struct {
		Name      string            `json:"name" yaml:"name"`
		Labels    map[string]string `json:"labels,omitempty" yaml:"labels,omitempty"`
		Version   string            `json:"version,omitempty" yaml:"version,omitempty"`
		ExportedAt string           `json:"exportedAt,omitempty" yaml:"exportedAt,omitempty"`
	} `json:"metadata" yaml:"metadata"`
	Spec struct {
		ProjectID    string `json:"projectId,omitempty" yaml:"projectId,omitempty"`
		Description  string `json:"description,omitempty" yaml:"description,omitempty"`
		ScriptType   string `json:"scriptType" yaml:"scriptType"`
		TargetURL    string `json:"targetUrl" yaml:"targetUrl"`
		VirtualUsers int    `json:"virtualUsers" yaml:"virtualUsers"`
		Engine       string `json:"engine,omitempty" yaml:"engine,omitempty"`
		Region       string `json:"region,omitempty" yaml:"region,omitempty"`
		Environment  string `json:"environment,omitempty" yaml:"environment,omitempty"`
	} `json:"spec" yaml:"spec"`
}

// ExportTest builds a manifest from platform test fields.
func ExportTest(name, projectID, description, scriptType, targetURL string, vus int) TestManifest {
	m := TestManifest{
		APIVersion: "speedrunner.io/v1alpha1",
		Kind:       "PerformanceTest",
	}
	m.Metadata.Name = name
	m.Metadata.Version = "1"
	m.Metadata.ExportedAt = time.Now().UTC().Format(time.RFC3339)
	m.Metadata.Labels = map[string]string{"managed-by": "speedrunner"}
	m.Spec.ProjectID = projectID
	m.Spec.Description = description
	m.Spec.ScriptType = scriptType
	m.Spec.TargetURL = targetURL
	m.Spec.VirtualUsers = vus
	m.Spec.Engine = strings.ToLower(scriptType)
	if m.Spec.Engine == "truclient" {
		m.Spec.Engine = "playwright"
	}
	return m
}

// ToYAML emits a minimal YAML document without external deps.
func (m TestManifest) ToYAML() string {
	var b strings.Builder
	b.WriteString("apiVersion: " + m.APIVersion + "\n")
	b.WriteString("kind: " + m.Kind + "\n")
	b.WriteString("metadata:\n")
	b.WriteString("  name: " + quote(m.Metadata.Name) + "\n")
	b.WriteString("  version: " + quote(m.Metadata.Version) + "\n")
	b.WriteString("  exportedAt: " + quote(m.Metadata.ExportedAt) + "\n")
	b.WriteString("spec:\n")
	if m.Spec.ProjectID != "" {
		b.WriteString("  projectId: " + quote(m.Spec.ProjectID) + "\n")
	}
	if m.Spec.Description != "" {
		b.WriteString("  description: " + quote(m.Spec.Description) + "\n")
	}
	b.WriteString("  scriptType: " + quote(m.Spec.ScriptType) + "\n")
	b.WriteString("  targetUrl: " + quote(m.Spec.TargetURL) + "\n")
	b.WriteString(fmt.Sprintf("  virtualUsers: %d\n", m.Spec.VirtualUsers))
	if m.Spec.Engine != "" {
		b.WriteString("  engine: " + quote(m.Spec.Engine) + "\n")
	}
	if m.Spec.Region != "" {
		b.WriteString("  region: " + quote(m.Spec.Region) + "\n")
	}
	return b.String()
}

// ToJSON serializes the manifest.
func (m TestManifest) ToJSON() ([]byte, error) {
	return json.MarshalIndent(m, "", "  ")
}

// ParseJSON imports a manifest.
func ParseJSON(data []byte) (*TestManifest, error) {
	var m TestManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	if m.Kind == "" {
		m.Kind = "PerformanceTest"
	}
	if m.Spec.VirtualUsers <= 0 {
		m.Spec.VirtualUsers = 10
	}
	return &m, nil
}

// DriftResult compares two manifests.
type DriftResult struct {
	HasDrift bool     `json:"hasDrift"`
	Fields   []string `json:"fields,omitempty"`
}

// DetectDrift compares live vs desired GitOps definitions.
func DetectDrift(live, desired TestManifest) DriftResult {
	var fields []string
	if live.Spec.TargetURL != desired.Spec.TargetURL {
		fields = append(fields, "spec.targetUrl")
	}
	if live.Spec.VirtualUsers != desired.Spec.VirtualUsers {
		fields = append(fields, "spec.virtualUsers")
	}
	if live.Spec.ScriptType != desired.Spec.ScriptType {
		fields = append(fields, "spec.scriptType")
	}
	if live.Spec.Engine != desired.Spec.Engine {
		fields = append(fields, "spec.engine")
	}
	return DriftResult{HasDrift: len(fields) > 0, Fields: fields}
}

func quote(s string) string {
	if strings.ContainsAny(s, ":#\n\"'") || strings.TrimSpace(s) != s {
		return fmt.Sprintf("%q", s)
	}
	return s
}
