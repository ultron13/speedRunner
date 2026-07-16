import { create } from "zustand";

import { generateToken } from "@/lib/auth";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import type {
  AuthState,
  CreateUserData,
  LoginCredentials,
  Permission,
  User,
  UserRole,
} from "@/types";

const STORAGE_KEY = "speedrunner-auth";
const TOKEN_KEY = "speedrunner-token";

/** Map Go control-plane roles onto the UI role set. */
export function mapBackendRole(role: string): UserRole {
  switch (role) {
    case "PLATFORM_ADMIN":
    case "admin":
      return "admin";
    case "PERFORMANCE_LEAD":
    case "PERFORMANCE_ENGINEER":
    case "DEVELOPER":
    case "QA":
    case "SERVICE_ACCOUNT":
    case "editor":
      return "editor";
    default:
      return "viewer";
  }
}

const mockUsers: (User & { password: string })[] = [
  {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin User",
    password: "admin123",
    role: "admin",
    createdAt: "2025-01-01T00:00:00Z",
    lastLoginAt: null,
  },
  {
    id: "user-2",
    email: "editor@example.com",
    name: "Editor User",
    password: "editor123",
    role: "editor",
    createdAt: "2025-01-15T00:00:00Z",
    lastLoginAt: null,
  },
  {
    id: "user-3",
    email: "viewer@example.com",
    name: "Viewer User",
    password: "viewer123",
    role: "viewer",
    createdAt: "2025-02-01T00:00:00Z",
    lastLoginAt: null,
  },
];

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    { action: "create", resource: "tests" },
    { action: "read", resource: "tests" },
    { action: "update", resource: "tests" },
    { action: "delete", resource: "tests" },
    { action: "read", resource: "runs" },
    { action: "delete", resource: "runs" },
    { action: "create", resource: "templates" },
    { action: "read", resource: "templates" },
    { action: "update", resource: "templates" },
    { action: "delete", resource: "templates" },
    { action: "update", resource: "settings" },
    { action: "read", resource: "users" },
    { action: "create", resource: "users" },
    { action: "update", resource: "users" },
    { action: "delete", resource: "users" },
  ],
  editor: [
    { action: "create", resource: "tests" },
    { action: "read", resource: "tests" },
    { action: "update", resource: "tests" },
    { action: "read", resource: "runs" },
    { action: "create", resource: "templates" },
    { action: "read", resource: "templates" },
    { action: "update", resource: "templates" },
  ],
  viewer: [
    { action: "read", resource: "tests" },
    { action: "read", resource: "runs" },
    { action: "read", resource: "templates" },
  ],
};

function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return { user: data.user, token: data.token };
    }
  } catch {
    // ignore
  }
  return { user: null, token: null };
}

function saveAuth(user: User, token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
}

function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  createUser: (data: CreateUserData) => User | null;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  getAllUsers: () => User[];
  hasPermission: (action: Permission["action"], resource: Permission["resource"]) => boolean;
  clearError: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: () => {
    const { user, token } = getStoredAuth();
    if (user && token) {
      apiClient.setToken(token);
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
      }
      set({ user, isAuthenticated: true });
      return;
    }

    // Restore token from API login path and validate against Go backend
    if (typeof window !== "undefined" && isGoBackendEnabled()) {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        apiClient.setToken(storedToken);
        void apiClient
          .getMe()
          .then((me) => {
            const mapped: User = {
              id: me.id as string,
              email: me.email as string,
              name: me.name as string,
              role: mapBackendRole((me.role as string) || "READ_ONLY"),
              createdAt: (me.createdAt as string) || new Date().toISOString(),
              lastLoginAt: null,
            };
            saveAuth(mapped, storedToken);
            set({ user: mapped, isAuthenticated: true });
          })
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
            apiClient.setToken(null);
            clearAuth();
          });
      }
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });

    // Prefer Go control plane when configured
    if (isGoBackendEnabled()) {
      try {
        const response = await apiClient.login(credentials.email, credentials.password);
        const raw = response.user;
        const user: User = {
          id: raw.id as string,
          email: raw.email as string,
          name: raw.name as string,
          role: mapBackendRole((raw.role as string) || "READ_ONLY"),
          createdAt: (raw.createdAt as string) || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        apiClient.setToken(response.token);
        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, response.token);
        }
        saveAuth(user, response.token);
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        set({ isLoading: false, error: message });
        return false;
      }
    }

    // Mock auth fallback (demo without backend)
    await new Promise((resolve) => setTimeout(resolve, 300));

    const foundUser = mockUsers.find(
      (u) => u.email === credentials.email && u.password === credentials.password,
    );

    if (!foundUser) {
      set({ isLoading: false, error: "Invalid email or password" });
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...userWithoutPassword } = foundUser;
    const user: User = {
      ...userWithoutPassword,
      lastLoginAt: new Date().toISOString(),
    };
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    saveAuth(user, token);
    set({ user, isAuthenticated: true, isLoading: false });
    return true;
  },

  logout: () => {
    clearAuth();
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
    apiClient.setToken(null);
    set({ user: null, isAuthenticated: false, error: null });
  },

  createUser: (data) => {
    const { user } = get();
    if (!user || user.role !== "admin") {
      set({ error: "Only admins can create users" });
      return null;
    }

    const exists = mockUsers.some((u) => u.email === data.email);
    if (exists) {
      set({ error: "Email already exists" });
      return null;
    }

    const newUser: User & { password: string } = {
      id: `user-${Date.now()}`,
      email: data.email,
      name: data.name,
      password: data.password,
      role: data.role,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    mockUsers.push(newUser);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  updateUser: (id, updates) => {
    const { user } = get();
    if (!user || (user.role !== "admin" && user.id !== id)) {
      set({ error: "Permission denied" });
      return;
    }

    const index = mockUsers.findIndex((u) => u.id === id);
    if (index === -1) return;

    mockUsers[index] = { ...mockUsers[index], ...updates };

    // Update current user if editing self
    if (user.id === id) {
      const updatedUser = { ...user, ...updates };
      const token = generateToken({ userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role });
      saveAuth(updatedUser, token);
      set({ user: updatedUser });
    }
  },

  deleteUser: (id) => {
    const { user } = get();
    if (!user || user.role !== "admin") {
      set({ error: "Only admins can delete users" });
      return;
    }

    if (user.id === id) {
      set({ error: "Cannot delete your own account" });
      return;
    }

    const index = mockUsers.findIndex((u) => u.id === id);
    if (index !== -1) {
      mockUsers.splice(index, 1);
    }
  },

  getAllUsers: () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return mockUsers.map(({ password: _pw, ...user }) => user);
  },

  hasPermission: (action, resource) => {
    const { user } = get();
    if (!user) return false;

    const permissions = rolePermissions[user.role] ?? [];
    return permissions.some(
      (p) => p.action === action && p.resource === resource,
    );
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Helper hook for permission checks
export function usePermission(action: Permission["action"], resource: Permission["resource"]) {
  return useAuthStore((state) => {
    if (!state.user) return false;
    const permissions = rolePermissions[state.user.role] ?? [];
    return permissions.some((p) => p.action === action && p.resource === resource);
  });
}
