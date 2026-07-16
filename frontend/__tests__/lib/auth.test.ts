import { describe, expect, it } from "vitest";

import { generateToken, verifyToken } from "@/lib/auth";

describe("auth token helpers", () => {
  it("generates a three-part token", () => {
    const token = generateToken({
      userId: "u1",
      email: "admin@example.com",
      role: "admin",
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("round-trips payload through verifyToken", () => {
    const token = generateToken({
      userId: "user-1",
      email: "admin@example.com",
      role: "admin",
    });
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("user-1");
    expect(payload?.email).toBe("admin@example.com");
    expect(payload?.role).toBe("admin");
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects malformed tokens", () => {
    expect(verifyToken("not-a-token")).toBeNull();
    expect(verifyToken("a.b")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });

  it("rejects tokens with invalid signatures when HMAC is available", () => {
    const token = generateToken({
      userId: "u1",
      email: "a@b.com",
      role: "viewer",
    });
    const parts = token.split(".");
    // Flip last char of signature (unless demo)
    if (parts[2] !== "demo") {
      const bad = `${parts[0]}.${parts[1]}.deadbeef`;
      expect(verifyToken(bad)).toBeNull();
    } else {
      // Browser-style demo signature path still decodes
      expect(verifyToken(token)).not.toBeNull();
    }
  });
});
