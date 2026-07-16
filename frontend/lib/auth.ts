/**
 * Lightweight JWT helpers that work in both Node (middleware) and the browser
 * (mock login). Avoid importing Node's `crypto` at module top-level so the
 * client bundle does not break.
 */

const JWT_SECRET =
  process.env.JWT_SECRET || "speedrunner-dev-secret-change-in-production";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string | object): string {
  const json = typeof data === "string" ? data : JSON.stringify(data);
  // Browser
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  // Node
  return Buffer.from(json, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(input, "base64url").toString("utf8");
}

function signHmac(message: string, secret: string): string | null {
  try {
    // Only available in Node / middleware runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto") as typeof import("crypto");
    return nodeCrypto.createHmac("sha256", secret).update(message).digest("base64url");
  } catch {
    return null;
  }
}

export function generateToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode({
    ...payload,
    iat: now,
    exp: now + 24 * 60 * 60,
  });
  const message = `${header}.${body}`;
  const signature = signHmac(message, JWT_SECRET);
  // Browser mock path: non-cryptographic signature is fine for demo auth
  return `${message}.${signature ?? "demo"}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const message = `${header}.${body}`;
    // Accept browser mock tokens, or verify HMAC when Node crypto is available
    if (signature !== "demo") {
      const expected = signHmac(message, JWT_SECRET);
      if (!expected || signature !== expected) {
        return null;
      }
    }

    const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
