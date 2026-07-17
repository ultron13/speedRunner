import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyToken } from "./lib/auth";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/api/health", "/_next", "/favicon.ico"];

// Routes that require admin role
const ADMIN_PATHS = ["/api/admin", "/api/users"];

// Routes that require editor or admin role
const EDITOR_PATHS = ["/api/tests", "/api/runs"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function requiresRole(pathname: string, _requiredRoles?: string[]): { required: boolean; role: string } | null {
  void _requiredRoles;
  for (const path of ADMIN_PATHS) {
    if (pathname.startsWith(path)) {
      return { required: true, role: "admin" };
    }
  }
  for (const path of EDITOR_PATHS) {
    if (pathname.startsWith(path)) {
      return { required: true, role: "editor" };
    }
  }
  return null;
}

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    viewer: 0,
    editor: 1,
    admin: 2,
  };
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for API routes
  if (pathname.startsWith("/api/")) {
    const token = extractTokenFromHeader(request.headers.get("authorization") ?? undefined);

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // Check role-based authorization
    const roleCheck = requiresRole(pathname, ["admin", "editor"]);
    if (roleCheck?.required && !hasRequiredRole(payload.role, roleCheck.role)) {
      return NextResponse.json(
        { error: `Insufficient permissions. Required: ${roleCheck.role}` },
        { status: 403 },
      );
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.userId);
    response.headers.set("x-user-email", payload.email);
    response.headers.set("x-user-role", payload.role);
    return response;
  }

  // For non-API routes, check for session cookie or redirect to login
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
