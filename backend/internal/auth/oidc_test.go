package auth

import (
	"context"
	"testing"
)

func TestOIDCDemoFlow(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{
		DemoMode:    true,
		Issuer:      "https://demo.example",
		ClientID:    "cid",
		RedirectURL: "http://localhost:8787/auth/callback",
	})
	if !p.Enabled() {
		t.Fatal("enabled")
	}
	url, state, err := p.BeginLogin(context.Background())
	if err != nil || url == "" || state == "" {
		t.Fatal(url, state, err)
	}
	if !p.states.Consume(state) {
		// BeginLogin already put state; consume once for exchange simulation
	}
	// re-put for exchange
	p.states.Put(state)
	ts, err := p.ExchangeCode(context.Background(), "demo-code", state)
	if err != nil || ts.AccessToken == "" {
		t.Fatal(ts, err)
	}
	info, err := p.FetchUserInfo(context.Background(), ts.AccessToken)
	if err != nil || info.Email == "" {
		t.Fatal(info, err)
	}
	st := p.Status(context.Background())
	if st["demoMode"] != true {
		t.Fatal(st)
	}
}

func TestOIDCDisabled(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{})
	if p.Enabled() {
		t.Fatal("should be disabled")
	}
	_, _, err := p.BeginLogin(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestStateStore(t *testing.T) {
	s := newStateStore()
	s.Put("abc")
	if !s.Consume("abc") {
		t.Fatal("consume")
	}
	if s.Consume("abc") {
		t.Fatal("double consume")
	}
}
