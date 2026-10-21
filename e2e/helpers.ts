import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BASE_URL } from "./playwright.config";

export const API_URL = `${BASE_URL}/api`;
export const MCP_URL = `${BASE_URL}/mcp`;
/** Short links are served on the apex (SHORT_URL_SCHEME=http locally). */
export const BASE_URL_SHORT = BASE_URL;

/**
 * Identity lives at accounts.3m4.net. Locally that is the accounts stack on
 * :8085 (Mailpit on :8025 for the verification mail); the `3m4_session`
 * cookie it sets for `localhost` is sent to this app on :8080 as well.
 */
export const ACCOUNTS_URL = (process.env.E2E_ACCOUNTS_URL || "http://localhost:8085").replace(/\/$/, "");
export const MAILPIT_URL = (process.env.E2E_MAILPIT_URL || "http://localhost:8025").replace(/\/$/, "");
export const SESSION_COOKIE = "3m4_session";

export const PASSWORD = "E2e-Passw0rd!";

export type Role = "viewer" | "editor" | "admin";

export interface Account {
  email: string;
  password: string;
  /** Accounts identity id (`sub`). */
  identityId: string;
  handle: string;
  /** The app's local user / account ids, from /auth/me. */
  userId: string;
  accountId: string;
  /** The current `3m4_session` JWT (also accepted as a bearer by the API). */
  sessionToken: string;
}

export function uniqueEmail(tag = "e2e"): string {
  return `${tag}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniqueUrl(): string {
  return `https://example.com/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Mailpit (local accounts stack) ──────────────────────────────────────── */

interface MailpitSummary {
  ID: string;
  Created: string;
}

async function mailpitJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MAILPIT_URL}/api/v1${path}`);
  if (!res.ok) throw new Error(`mailpit ${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** The accounts e-mail verification token sent to `email` (polls Mailpit). */
export async function waitForVerifyToken(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await mailpitJson<{ messages: MailpitSummary[] }>(
      `/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    for (const m of found.messages ?? []) {
      const msg = await mailpitJson<{ Text?: string; HTML?: string }>(`/message/${m.ID}`);
      const match = `${msg.Text ?? ""}\n${msg.HTML ?? ""}`.match(/verify\?token=([A-Za-z0-9_-]+)/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no verification mail for ${email} at ${MAILPIT_URL}`);
}

async function sessionCookie(request: APIRequestContext): Promise<string> {
  const state = await request.storageState();
  const cookie = state.cookies.find((c) => c.name === SESSION_COOKIE);
  expect(cookie, "3m4_session cookie after accounts login").toBeTruthy();
  return cookie!.value;
}

/**
 * Create a fresh, verified identity at accounts and let this app provision
 * its tenant. The cookies stay in `request`'s jar, so later calls to the app
 * API from the same context are authenticated. Never reuses existing data.
 */
export async function registerAccount(
  request: APIRequestContext,
  opts: { email?: string } = {},
): Promise<Account> {
  const email = opts.email ?? uniqueEmail();
  const signup = await request.post(`${ACCOUNTS_URL}/api/auth/signup`, {
    data: { email, password: PASSWORD },
  });
  expect(signup.status(), `accounts signup ${email}: ${await signup.text()}`).toBe(201);
  const identity = (await signup.json()).user as { id: string; handle: string };

  // Verify the e-mail (the app refuses writes until then) and refresh so the
  // access cookie carries email_verified=true.
  const token = await waitForVerifyToken(email);
  const verify = await request.post(`${ACCOUNTS_URL}/api/auth/verify/consume`, { data: { token } });
  expect(verify.status(), `verify consume: ${await verify.text()}`).toBe(200);
  const refresh = await request.post(`${ACCOUNTS_URL}/api/session/refresh`, { data: {} });
  expect(refresh.status(), `session refresh: ${await refresh.text()}`).toBe(200);

  // First call provisions the local user + workspace.
  const me = await request.get(`${API_URL}/auth/me`);
  expect(me.status(), `auth/me: ${await me.text()}`).toBe(200);
  const body = await me.json();
  return {
    email,
    password: PASSWORD,
    identityId: identity.id,
    handle: identity.handle,
    userId: body.user.id,
    accountId: body.account.id,
    sessionToken: await sessionCookie(request),
  };
}

/** Bearer form of the session (for request contexts without the cookie jar). */
export function jwtHeaders(account: Pick<Account, "sessionToken">) {
  return { Authorization: `Bearer ${account.sessionToken}` };
}

export function keyHeaders(key: string) {
  return { "X-API-Key": key };
}

/** POST /api/apikeys with the session. Returns the one-time secret plus metadata. */
export async function createApiKey(
  request: APIRequestContext,
  account: Account,
  name: string,
  role: Role,
): Promise<{ id: string; key: string; prefix: string; role: Role }> {
  const res = await request.post(`${API_URL}/apikeys`, {
    headers: jwtHeaders(account),
    data: { name, role },
  });
  expect(res.status(), `create api key: ${await res.text()}`).toBe(201);
  return res.json();
}

/**
 * Give the browser the accounts session of `account` (fast path for dashboard
 * tests): sets the `3m4_session` cookie for the app's host exactly as accounts
 * would (host-only on localhost). The token is good for 15 minutes, plenty for
 * a spec; no refresh cookie is seeded. No navigation needed.
 */
export async function seedSession(page: Page, account: Pick<Account, "sessionToken">): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: account.sessionToken,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Poll an async condition (e.g. worker-processed clicks) until it holds. */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  { timeoutMs = 15_000, intervalMs = 500 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T = await fn();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fn();
  }
  return last;
}

/* ─── MCP (Streamable HTTP) ────────────────────────────────────────────── */

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Parse a Streamable HTTP response body. The server may answer with plain JSON
 * or with SSE frames ("event: message\ndata: {...}\n\n"); return every JSON-RPC
 * message found, in order.
 */
export function parseMcpBody(contentType: string | undefined, body: string): JsonRpcResponse[] {
  const text = body.trim();
  if (!text) return [];
  if (!(contentType ?? "").includes("text/event-stream")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const messages: JsonRpcResponse[] = [];
  for (const frame of text.split(/\n\n+/)) {
    const data = frame
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (data) messages.push(JSON.parse(data));
  }
  return messages;
}

export interface McpCallResult {
  status: number;
  messages: JsonRpcResponse[];
  raw: string;
}

export async function mcpRpc(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown> = {},
  opts: { apiKey?: string; id?: number } = {},
): Promise<McpCallResult> {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  const res = await request.post(MCP_URL, {
    headers,
    data: { jsonrpc: "2.0", id: opts.id ?? 1, method, params },
    maxRedirects: 0,
  });
  const raw = await res.text();
  let messages: JsonRpcResponse[] = [];
  try {
    messages = parseMcpBody(res.headers()["content-type"], raw);
  } catch {
    /* non-JSON body (e.g. 401 text) — caller inspects status/raw */
  }
  return { status: res.status(), messages, raw };
}

export const MCP_INIT_PARAMS = {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "3m4-e2e", version: "0.0.0" },
};

/** Convenience: initialize then return the first result message of `method`. */
export async function mcpCall(
  request: APIRequestContext,
  apiKey: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<JsonRpcResponse> {
  const init = await mcpRpc(request, "initialize", MCP_INIT_PARAMS, { apiKey, id: 1 });
  expect(init.status, `initialize: ${init.raw}`).toBe(200);
  expect(init.messages[0]?.result?.serverInfo?.name).toBe("3m4");
  const out = await mcpRpc(request, method, params, { apiKey, id: 2 });
  expect(out.status, `${method}: ${out.raw}`).toBe(200);
  const msg = out.messages.find((m) => m.id === 2) ?? out.messages[0];
  expect(msg, `${method}: no JSON-RPC message in body: ${out.raw}`).toBeTruthy();
  return msg!;
}

export const ALL_MCP_TOOLS = [
  "list_links",
  "get_link",
  "get_link_analytics",
  "get_account_overview",
  "get_usage",
  "create_link",
  "update_link",
  "delete_link",
  "get_audit_log",
] as const;
