import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("auth store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("initializes with no user", () => {
    useAuthStore.getState().initialize();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("logs in with valid credentials", async () => {
    const result = await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("admin@example.com");
    expect(useAuthStore.getState().user?.role).toBe("admin");
  });

  it("rejects invalid credentials", async () => {
    const result = await useAuthStore.getState().login({
      email: "wrong@example.com",
      password: "wrong",
    });

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe("Invalid email or password");
  });

  it("logs out successfully", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("checks permissions correctly", async () => {
    // Login as admin
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    expect(useAuthStore.getState().hasPermission("create", "tests")).toBe(true);
    expect(useAuthStore.getState().hasPermission("delete", "users")).toBe(true);

    // Logout and login as viewer
    useAuthStore.getState().logout();
    await useAuthStore.getState().login({
      email: "viewer@example.com",
      password: "viewer123",
    });

    expect(useAuthStore.getState().hasPermission("create", "tests")).toBe(false);
    expect(useAuthStore.getState().hasPermission("read", "tests")).toBe(true);
  });

  it("creates user as admin", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    const newUser = useAuthStore.getState().createUser({
      email: "new@example.com",
      name: "New User",
      password: "pass123",
      role: "editor",
    });

    expect(newUser).not.toBeNull();
    expect(newUser?.email).toBe("new@example.com");
    expect(newUser?.role).toBe("editor");
  });

  it("prevents non-admin from creating users", async () => {
    await useAuthStore.getState().login({
      email: "viewer@example.com",
      password: "viewer123",
    });

    const newUser = useAuthStore.getState().createUser({
      email: "new@example.com",
      name: "New User",
      password: "pass123",
      role: "editor",
    });

    expect(newUser).toBeNull();
    expect(useAuthStore.getState().error).toBe("Only admins can create users");
  });

  it("returns all users", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    const users = useAuthStore.getState().getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(3);
    expect(users.every((u) => !("password" in u))).toBe(true);
  });

  it("clears error", async () => {
    await useAuthStore.getState().login({
      email: "wrong@example.com",
      password: "wrong",
    });

    expect(useAuthStore.getState().error).not.toBeNull();
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("prevents duplicate email creation", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    const result = useAuthStore.getState().createUser({
      email: "admin@example.com",
      name: "Duplicate",
      password: "pass123",
      role: "editor",
    });

    expect(result).toBeNull();
    expect(useAuthStore.getState().error).toBe("Email already exists");
  });

  it("prevents deleting own account", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    const userId = useAuthStore.getState().user?.id;
    useAuthStore.getState().deleteUser(userId!);
    expect(useAuthStore.getState().error).toBe("Cannot delete your own account");
  });

  it("updates user profile", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    const userId = useAuthStore.getState().user?.id;
    useAuthStore.getState().updateUser(userId!, { name: "Updated Name" });
    expect(useAuthStore.getState().user?.name).toBe("Updated Name");
  });

  it("returns false for permissions when not authenticated", () => {
    expect(useAuthStore.getState().hasPermission("read", "tests")).toBe(false);
  });

  it("handles editor permissions correctly", async () => {
    await useAuthStore.getState().login({
      email: "editor@example.com",
      password: "editor123",
    });

    expect(useAuthStore.getState().hasPermission("create", "tests")).toBe(true);
    expect(useAuthStore.getState().hasPermission("delete", "tests")).toBe(false);
    expect(useAuthStore.getState().hasPermission("read", "users")).toBe(false);
  });

  it("persists auth to localStorage", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("clears auth from localStorage on logout", async () => {
    await useAuthStore.getState().login({
      email: "admin@example.com",
      password: "admin123",
    });

    useAuthStore.getState().logout();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });
});
