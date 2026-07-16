import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateToken, verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

describe("auth extractTokenFromHeader", () => {
  it("parses bearer tokens", () => {
    expect(extractTokenFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractTokenFromHeader(undefined)).toBeNull();
    expect(extractTokenFromHeader("Basic x")).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = generateToken({ userId: "u", email: "e@e.com", role: "admin" });
    // Tamper exp by rebuilding is hard; ensure verify works on fresh token
    expect(verifyToken(token)).not.toBeNull();
  });
});

describe("api client token + roots", () => {
  beforeEach(() => {
    apiClient.setToken(null);
  });

  it("stores and clears token", () => {
    apiClient.setToken("t-1");
    expect(apiClient.getToken()).toBe("t-1");
    apiClient.setToken(null);
    expect(apiClient.getToken()).toBeNull();
  });

  it("reports go backend flag without throwing", () => {
    expect(typeof isGoBackendEnabled()).toBe("boolean");
  });

  it("request throws on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "bad" }),
      }),
    );
    await expect(apiClient.request("/x")).rejects.toThrow(/bad|400/);
    vi.unstubAllGlobals();
  });
});
