import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyToken } from "./lib/auth";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/api/health", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
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
