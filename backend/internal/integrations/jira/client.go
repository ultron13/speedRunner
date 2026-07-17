package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is a real Jira Cloud/Server REST API adapter (API v3 style).
type Config struct {
	BaseURL  string // e.g. https://your-domain.atlassian.net
	Email    string // Atlassian account email
	APIToken string
	// DemoMode returns simulated responses without calling Jira.
	DemoMode bool
}

type Client struct {
	cfg        Config
	httpClient *http.Client
}

func New(cfg Config) *Client {
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.BaseURL == "" || cfg.APIToken == "" {
		cfg.DemoMode = true
	}
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (c *Client) Configured() bool {
	return c.cfg.BaseURL != "" && c.cfg.APIToken != ""
}

func (c *Client) DemoMode() bool {
	return c.cfg.DemoMode
}

func (c *Client) Status() map[string]interface{} {
	return map[string]interface{}{
		"configured": c.Configured(),
		"demoMode":   c.cfg.DemoMode,
		"baseUrl":    c.cfg.BaseURL,
		"email":      maskEmail(c.cfg.Email),
	}
}

func maskEmail(e string) string {
	if e == "" {
		return ""
	}
	parts := strings.Split(e, "@")
	if len(parts) != 2 {
		return "***"
	}
	if len(parts[0]) <= 2 {
		return "**@" + parts[1]
	}
	return parts[0][:2] + "***@" + parts[1]
}

type IssueRequest struct {
	ProjectKey  string `json:"projectKey"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
	IssueType   string `json:"issueType"` // Bug|Task|Story
	Labels      []string `json:"labels,omitempty"`
	Priority    string `json:"priority,omitempty"`
}

type Issue struct {
	ID     string `json:"id"`
	Key    string `json:"key"`
	Self   string `json:"self"`
	Fields map[string]interface{} `json:"fields,omitempty"`
}

type SearchResult struct {
	StartAt    int     `json:"startAt"`
	MaxResults int     `json:"maxResults"`
	Total      int     `json:"total"`
	Issues     []Issue `json:"issues"`
}

func (c *Client) CreateIssue(ctx context.Context, in IssueRequest) (*Issue, error) {
	if in.ProjectKey == "" || in.Summary == "" {
		return nil, fmt.Errorf("projectKey and summary required")
	}
	if in.IssueType == "" {
		in.IssueType = "Bug"
	}
	if c.cfg.DemoMode {
		key := fmt.Sprintf("%s-%d", strings.ToUpper(in.ProjectKey), time.Now().Unix()%10000)
		return &Issue{
			ID:  "10001",
			Key: key,
			Self: c.cfg.BaseURL + "/rest/api/3/issue/10001",
			Fields: map[string]interface{}{
				"summary": in.Summary,
				"status":  map[string]string{"name": "To Do"},
				"demo":    true,
			},
		}, nil
	}

	// ADF description for Jira Cloud API v3
	payload := map[string]interface{}{
		"fields": map[string]interface{}{
			"project":   map[string]string{"key": in.ProjectKey},
			"summary":   in.Summary,
			"issuetype": map[string]string{"name": in.IssueType},
			"description": map[string]interface{}{
				"type":    "doc",
				"version": 1,
				"content": []map[string]interface{}{
					{
						"type": "paragraph",
						"content": []map[string]interface{}{
							{"type": "text", "text": in.Description},
						},
					},
				},
			},
		},
	}
	if len(in.Labels) > 0 {
		payload["fields"].(map[string]interface{})["labels"] = in.Labels
	}
	if in.Priority != "" {
		payload["fields"].(map[string]interface{})["priority"] = map[string]string{"name": in.Priority}
	}

	var out Issue
	if err := c.do(ctx, http.MethodPost, "/rest/api/3/issue", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) GetIssue(ctx context.Context, key string) (*Issue, error) {
	if c.cfg.DemoMode {
		return &Issue{
			ID: "10001", Key: key,
			Fields: map[string]interface{}{
				"summary": "Demo issue",
				"status":  map[string]string{"name": "In Progress"},
				"demo":    true,
			},
		}, nil
	}
	var out Issue
	if err := c.do(ctx, http.MethodGet, "/rest/api/3/issue/"+url.PathEscape(key), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Search(ctx context.Context, jql string, maxResults int) (*SearchResult, error) {
	if maxResults <= 0 {
		maxResults = 25
	}
	if jql == "" {
		jql = "order by created DESC"
	}
	if c.cfg.DemoMode {
		return &SearchResult{
			StartAt: 0, MaxResults: maxResults, Total: 1,
			Issues: []Issue{{
				ID: "10001", Key: "DEMO-1",
				Fields: map[string]interface{}{
					"summary": "Demo performance defect",
					"status":  map[string]string{"name": "Open"},
					"demo":    true,
				},
			}},
		}, nil
	}
	body := map[string]interface{}{
		"jql":        jql,
		"maxResults": maxResults,
		"fields":     []string{"summary", "status", "assignee", "priority", "created"},
	}
	var out SearchResult
	if err := c.do(ctx, http.MethodPost, "/rest/api/3/search", body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateDefectFromRun builds a performance defect issue from run evidence.
func (c *Client) CreateDefectFromRun(ctx context.Context, projectKey, runID, testName string, errorRate, p95 float64, evidenceURL string) (*Issue, error) {
	summary := fmt.Sprintf("[Perf] %s failed SLA (run %s)", testName, runID)
	desc := fmt.Sprintf(
		"Performance defect auto-drafted by SpeedRunner.\n\nRun: %s\nTest: %s\nError rate: %.2f%%\nP95: %.0f ms\nEvidence: %s\n",
		runID, testName, errorRate, p95, evidenceURL,
	)
	return c.CreateIssue(ctx, IssueRequest{
		ProjectKey:  projectKey,
		Summary:     summary,
		Description: desc,
		IssueType:   "Bug",
		Labels:      []string{"performance", "speedrunner"},
		Priority:    "High",
	})
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.cfg.BaseURL+path, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.cfg.Email != "" {
		req.SetBasicAuth(c.cfg.Email, c.cfg.APIToken)
	} else {
		req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("jira %s %s: HTTP %d: %s", method, path, resp.StatusCode, string(raw))
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}
