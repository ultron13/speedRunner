import { describe, expect, it } from "vitest";

import { createTestSchema } from "@/lib/validation";

describe("createTestSchema", () => {
  const valid = {
    name: "Login Flow Test",
    description: "Tests the login endpoint",
    scriptType: "HTTP" as const,
    targetUrl: "https://api.example.com/login",
    virtualUsers: 100,
  };

  it("accepts valid input", () => {
    const result = createTestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("requires name with at least 3 characters", () => {
    expect(createTestSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, name: "ab" }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, name: "abc" }).success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = createTestSchema.safeParse({ ...valid, name: "  Login Test  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Login Test");
  });

  it("allows empty description", () => {
    expect(createTestSchema.safeParse({ ...valid, description: "" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, description: undefined }).success).toBe(true);
  });

  it("rejects description over 500 characters", () => {
    expect(createTestSchema.safeParse({ ...valid, description: "a".repeat(501) }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, description: "a".repeat(500) }).success).toBe(true);
  });

  it("requires a valid scriptType", () => {
    expect(createTestSchema.safeParse({ ...valid, scriptType: "HTTP" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, scriptType: "TruClient" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, scriptType: "JMeter" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, scriptType: "Gatling" }).success).toBe(false);
  });

  it("requires a valid URL", () => {
    expect(createTestSchema.safeParse({ ...valid, targetUrl: "https://api.example.com" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, targetUrl: "not-a-url" }).success).toBe(false);
  });

  it("requires virtualUsers between 1 and 10000", () => {
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 0 }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 1 }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 10000 }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 10001 }).success).toBe(false);
  });

  it("requires virtualUsers to be an integer", () => {
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 1.5 }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 100 }).success).toBe(true);
  });

  it("coerces string numbers for virtualUsers", () => {
    const result = createTestSchema.safeParse({ ...valid, virtualUsers: "200" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.virtualUsers).toBe(200);
  });

  it("rejects missing required fields", () => {
    expect(createTestSchema.safeParse({}).success).toBe(false);
    expect(createTestSchema.safeParse({ name: "Test" }).success).toBe(false);
  });

  it("rejects invalid URL formats", () => {
    expect(createTestSchema.safeParse({ ...valid, targetUrl: "ftp://example.com" }).success).toBe(true);
    expect(createTestSchema.safeParse({ ...valid, targetUrl: "not-a-url" }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, targetUrl: "" }).success).toBe(false);
  });

  it("validates all script types", () => {
    const types = ["HTTP", "TruClient", "JMeter"];
    types.forEach((type) => {
      expect(
        createTestSchema.safeParse({ ...valid, scriptType: type }).success,
      ).toBe(true);
    });
  });

  it("handles edge cases for virtual users", () => {
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: -1 }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: 100000 }).success).toBe(false);
    expect(createTestSchema.safeParse({ ...valid, virtualUsers: NaN }).success).toBe(false);
  });
});
