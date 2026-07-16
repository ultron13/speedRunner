package gitops

import "testing"

func TestExportImportDrift(t *testing.T) {
	m := ExportTest("Login", "proj1", "desc", "JMeter", "https://example.com", 100)
	yml := m.ToYAML()
	if yml == "" {
		t.Fatal("empty yaml")
	}
	b, err := m.ToJSON()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := ParseJSON(b)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Metadata.Name != "Login" {
		t.Fatalf("name=%s", parsed.Metadata.Name)
	}
	desired := m
	desired.Spec.VirtualUsers = 200
	d := DetectDrift(m, desired)
	if !d.HasDrift {
		t.Fatal("expected drift")
	}
}
