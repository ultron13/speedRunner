package auth

type Role string

const (
	RolePlatformAdmin      Role = "PLATFORM_ADMIN"
	RolePerformanceLead    Role = "PERFORMANCE_LEAD"
	RolePerformanceEngineer Role = "PERFORMANCE_ENGINEER"
	RoleDeveloper          Role = "DEVELOPER"
	RoleQA                 Role = "QA"
	RoleReleaseManager     Role = "RELEASE_MANAGER"
	RoleReadOnly           Role = "READ_ONLY"
	RoleServiceAccount     Role = "SERVICE_ACCOUNT"
)

var rolePermissions = map[Role][]string{
	RolePlatformAdmin:      {"*"},
	RolePerformanceLead:    {"project:read", "project:write", "test:read", "test:write", "test:execute", "run:read", "run:execute", "schedule:read", "schedule:write", "sla:read", "sla:write", "audit:read", "admin:read", "admin:write"},
	RolePerformanceEngineer: {"project:read", "test:read", "test:write", "test:execute", "run:read", "run:execute", "schedule:read", "schedule:write", "sla:read", "sla:write"},
	RoleDeveloper:          {"project:read", "test:read", "test:write", "run:read", "schedule:read"},
	RoleQA:                 {"project:read", "test:read", "test:write", "test:execute", "run:read", "schedule:read"},
	RoleReleaseManager:     {"project:read", "test:read", "run:read", "schedule:read", "sla:read", "audit:read"},
	RoleReadOnly:           {"project:read", "test:read", "run:read"},
	RoleServiceAccount:     {"project:read", "test:read", "test:write", "test:execute", "run:read", "run:execute"},
}

func HasPermission(role Role, permission string) bool {
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	for _, p := range perms {
		if p == "*" || p == permission {
			return true
		}
	}
	return false
}

func IsValidRole(role string) bool {
	switch Role(role) {
	case RolePlatformAdmin, RolePerformanceLead, RolePerformanceEngineer,
		RoleDeveloper, RoleQA, RoleReleaseManager, RoleReadOnly, RoleServiceAccount:
		return true
	}
	return false
}
