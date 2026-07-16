package auth

import "testing"

func TestHasPermission(t *testing.T) {
	if !HasPermission(RolePlatformAdmin, "test:write") {
		t.Fatal("admin should have test:write")
	}
	if !HasPermission(RolePlatformAdmin, "anything") {
		t.Fatal("admin should have wildcard")
	}
	if HasPermission(RoleReadOnly, "test:write") {
		t.Fatal("read-only should not write tests")
	}
	if !HasPermission(RoleReadOnly, "test:read") {
		t.Fatal("read-only should read tests")
	}
	if !HasPermission(RolePerformanceEngineer, "test:execute") {
		t.Fatal("engineer should execute tests")
	}
}

func TestIsValidRole(t *testing.T) {
	if !IsValidRole("PLATFORM_ADMIN") {
		t.Fatal("PLATFORM_ADMIN should be valid")
	}
	if IsValidRole("superuser") {
		t.Fatal("superuser should be invalid")
	}
}
