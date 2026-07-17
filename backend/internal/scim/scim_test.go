package scim

import "testing"

func TestSCIMCRUD(t *testing.T) {
	s := NewStore("/scim/v2")
	u := s.Create(&User{
		UserName: "alice", DisplayName: "Alice", Active: true,
		Emails: []Email{{Value: "alice@ex.com", Primary: true}},
	})
	if u.ID == "" || u.Meta.ResourceType != "User" {
		t.Fatal(u)
	}
	got, ok := s.Get(u.ID)
	if !ok || got.UserName != "alice" {
		t.Fatal(got)
	}
	list := s.List(`userName eq "alice"`, 1, 10)
	if list.TotalResults < 1 {
		t.Fatal(list)
	}
	patched, err := s.Patch(u.ID, []map[string]interface{}{
		{"op": "replace", "path": "active", "value": false},
	})
	if err != nil || patched.Active {
		t.Fatal(patched, err)
	}
	if !s.Delete(u.ID) {
		t.Fatal("delete")
	}
	if _, ok := s.Get(u.ID); ok {
		t.Fatal("still there")
	}
	cfg := DefaultServiceProviderConfig()
	if len(cfg.Schemas) == 0 {
		t.Fatal("spc")
	}
}
