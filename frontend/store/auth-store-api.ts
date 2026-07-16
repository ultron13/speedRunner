/**
 * API integration for the auth store.
 * Connects to real authentication endpoints.
 */

import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "./auth-store";
import type { UserRole } from "@/types";

export async function loginViaAPI(email: string, password: string) {
  try {
    const response = await apiClient.login(email, password);
    
    // Store token
    apiClient.setToken(response.token);
    localStorage.setItem("speedrunner-token", response.token);
    
    // Update auth store
    const user = response.user as { id: string; email: string; name: string; role: string };
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

export async function fetchCurrentUser() {
  try {
    // Check for stored token
    const token = localStorage.getItem("speedrunner-token");
    if (!token) {
      return null;
    }

    apiClient.setToken(token);
    const user = await apiClient.getMe();
    
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: user.id as string,
        email: user.email as string,
        name: user.name as string,
        role: user.role as UserRole,
        createdAt: (user.createdAt as string) || new Date().toISOString(),
        lastLoginAt: (user.lastLoginAt as string) || null,
      },
    });

    return user;
  } catch (error) {
    // Token invalid or expired
    localStorage.removeItem("speedrunner-token");
    apiClient.setToken(null);
    return null;
  }
}

export function logoutViaAPI() {
  localStorage.removeItem("speedrunner-token");
  apiClient.setToken(null);
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
  });
}
