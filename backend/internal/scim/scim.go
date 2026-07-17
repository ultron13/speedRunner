package scim

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Minimal SCIM 2.0 (RFC 7643/7644) Users resource implementation.

const (
	SchemaUser     = "urn:ietf:params:scim:schemas:core:2.0:User"
	SchemaListResp = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
	SchemaError    = "urn:ietf:params:scim:api:messages:2.0:Error"
	SchemaPatch    = "urn:ietf:params:scim:api:messages:2.0:PatchOp"
)

type Email struct {
	Value   string `json:"value"`
	Type    string `json:"type,omitempty"`
	Primary bool   `json:"primary,omitempty"`
}

type Name struct {
	Formatted  string `json:"formatted,omitempty"`
	FamilyName string `json:"familyName,omitempty"`
	GivenName  string `json:"givenName,omitempty"`
}

type Meta struct {
	ResourceType string `json:"resourceType"`
	Created      string `json:"created"`
	LastModified string `json:"lastModified"`
	Location     string `json:"location,omitempty"`
}

type User struct {
	Schemas  []string `json:"schemas"`
	ID       string   `json:"id"`
	ExternalID string `json:"externalId,omitempty"`
	UserName string   `json:"userName"`
	Name     *Name    `json:"name,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
	Emails   []Email  `json:"emails,omitempty"`
	Active   bool     `json:"active"`
	Roles    []map[string]string `json:"roles,omitempty"`
	Meta     Meta     `json:"meta"`
}

type ListResponse struct {
	Schemas      []string `json:"schemas"`
	TotalResults int      `json:"totalResults"`
	StartIndex   int      `json:"startIndex"`
	ItemsPerPage int      `json:"itemsPerPage"`
	Resources    []*User  `json:"Resources"`
}

type ErrorResponse struct {
	Schemas []string `json:"schemas"`
	Status  string   `json:"status"`
	Detail  string   `json:"detail"`
	ScimType string  `json:"scimType,omitempty"`
}

type PatchOp struct {
	Schemas    []string                 `json:"schemas"`
	Operations []map[string]interface{} `json:"Operations"`
}

type ServiceProviderConfig struct {
	Schemas []string               `json:"schemas"`
	Patch   map[string]interface{} `json:"patch"`
	Bulk    map[string]interface{} `json:"bulk"`
	Filter  map[string]interface{} `json:"filter"`
	ChangePassword map[string]interface{} `json:"changePassword"`
	Sort    map[string]interface{} `json:"sort"`
	Etag    map[string]interface{} `json:"etag"`
	AuthenticationSchemes []map[string]interface{} `json:"authenticationSchemes"`
}

type Store struct {
	mu    sync.RWMutex
	users map[string]*User
	base  string // public base path e.g. /scim/v2
}

func NewStore(basePath string) *Store {
	if basePath == "" {
		basePath = "/scim/v2"
	}
	s := &Store{users: make(map[string]*User), base: basePath}
	// seed
	s.Create(&User{
		UserName: "scim.admin",
		DisplayName: "SCIM Admin",
		Active: true,
		Emails: []Email{{Value: "scim.admin@speedrunner.local", Primary: true, Type: "work"}},
		Name: &Name{Formatted: "SCIM Admin", GivenName: "SCIM", FamilyName: "Admin"},
		Roles: []map[string]string{{"value": "PLATFORM_ADMIN", "display": "Platform Admin"}},
	})
	return s
}

func (s *Store) Create(u *User) *User {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	u.Schemas = []string{SchemaUser}
	u.Meta = Meta{
		ResourceType: "User",
		Created:      now,
		LastModified: now,
		Location:     s.base + "/Users/" + u.ID,
	}
	if u.UserName == "" && len(u.Emails) > 0 {
		u.UserName = u.Emails[0].Value
	}
	cp := *u
	s.users[u.ID] = &cp
	return &cp
}

func (s *Store) Get(id string) (*User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil, false
	}
	cp := *u
	return &cp, true
}

func (s *Store) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[id]; !ok {
		return false
	}
	delete(s.users, id)
	return true
}

func (s *Store) List(filter string, start, count int) ListResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		if filter != "" && !matchFilter(u, filter) {
			continue
		}
		cp := *u
		all = append(all, &cp)
	}
	if start < 1 {
		start = 1
	}
	if count <= 0 {
		count = 100
	}
	from := start - 1
	if from > len(all) {
		from = len(all)
	}
	to := from + count
	if to > len(all) {
		to = len(all)
	}
	page := all[from:to]
	return ListResponse{
		Schemas:      []string{SchemaListResp},
		TotalResults: len(all),
		StartIndex:   start,
		ItemsPerPage: len(page),
		Resources:    page,
	}
}

func matchFilter(u *User, filter string) bool {
	// Supports: userName eq "x" | emails.value eq "x"
	f := strings.TrimSpace(filter)
	f = strings.ReplaceAll(f, `\"`, `"`)
	lower := strings.ToLower(f)
	if strings.HasPrefix(lower, "username eq ") {
		val := extractQuoted(f)
		return strings.EqualFold(u.UserName, val)
	}
	if strings.Contains(lower, "emails.value eq") || strings.HasPrefix(lower, "emails eq") {
		val := extractQuoted(f)
		for _, e := range u.Emails {
			if strings.EqualFold(e.Value, val) {
				return true
			}
		}
		return false
	}
	// fallback: substring
	return strings.Contains(strings.ToLower(u.UserName), strings.ToLower(f)) ||
		strings.Contains(strings.ToLower(u.DisplayName), strings.ToLower(f))
}

func extractQuoted(s string) string {
	i := strings.Index(s, `"`)
	if i < 0 {
		parts := strings.Fields(s)
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
		return ""
	}
	j := strings.LastIndex(s, `"`)
	if j <= i {
		return ""
	}
	return s[i+1 : j]
}

func (s *Store) Replace(id string, u *User) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old, ok := s.users[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	u.ID = id
	u.Schemas = []string{SchemaUser}
	u.Meta = old.Meta
	u.Meta.LastModified = time.Now().UTC().Format(time.RFC3339)
	u.Meta.Location = s.base + "/Users/" + id
	cp := *u
	s.users[id] = &cp
	return &cp, nil
}

func (s *Store) Patch(id string, ops []map[string]interface{}) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	for _, op := range ops {
		action, _ := op["op"].(string)
		path, _ := op["path"].(string)
		action = strings.ToLower(action)
		path = strings.ToLower(path)
		switch action {
		case "replace", "add":
			if path == "active" {
				if v, ok := op["value"].(bool); ok {
					u.Active = v
				}
			}
			if path == "displayname" {
				if v, ok := op["value"].(string); ok {
					u.DisplayName = v
				}
			}
			if path == "username" {
				if v, ok := op["value"].(string); ok {
					u.UserName = v
				}
			}
			// whole-object replace of attributes
			if path == "" {
				if m, ok := op["value"].(map[string]interface{}); ok {
					if v, ok := m["active"].(bool); ok {
						u.Active = v
					}
					if v, ok := m["displayName"].(string); ok {
						u.DisplayName = v
					}
					if v, ok := m["userName"].(string); ok {
						u.UserName = v
					}
				}
			}
		case "remove":
			if path == "emails" {
				u.Emails = nil
			}
		}
	}
	u.Meta.LastModified = time.Now().UTC().Format(time.RFC3339)
	cp := *u
	return &cp, nil
}

func DefaultServiceProviderConfig() ServiceProviderConfig {
	return ServiceProviderConfig{
		Schemas: []string{"urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"},
		Patch:   map[string]interface{}{"supported": true},
		Bulk:    map[string]interface{}{"supported": false, "maxOperations": 0, "maxPayloadSize": 0},
		Filter:  map[string]interface{}{"supported": true, "maxResults": 200},
		ChangePassword: map[string]interface{}{"supported": false},
		Sort:    map[string]interface{}{"supported": false},
		Etag:    map[string]interface{}{"supported": false},
		AuthenticationSchemes: []map[string]interface{}{
			{
				"type":        "oauthbearertoken",
				"name":        "OAuth Bearer Token",
				"description": "Authentication using SpeedRunner JWT or SCIM_TOKEN",
				"primary":     true,
			},
		},
	}
}

func NewError(status int, detail string) ErrorResponse {
	return ErrorResponse{
		Schemas: []string{SchemaError},
		Status:  fmt.Sprintf("%d", status),
		Detail:  detail,
	}
}
