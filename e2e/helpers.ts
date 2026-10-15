import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BASE_URL } from "./playwright.config";

export const API_URL = `${BASE_URL}/api`;
export const MCP_URL = `${BASE_URL}/mcp`;
/** Short links are served on the apex (SHORT_URL_SCHEME=http locally). */
export const BASE_URL_SHORT = BASE_URL;

/** localStorage keys used by apps/web/src/lib/auth.ts */
export const ACCESS_KEY = "3m4_access_token";
export const REFRESH_KEY = "3m4_refresh_token";

export const PASSWORD = "E2e-Passw0rd!";

export type Role = "viewer" | "editor" | "admin";

export interface Account {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  accountId: string;
}

export function uniqueEmail(tag = "e2e"): string {
  return `${tag}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniqueUrl(): string {
  return `https://example.com/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a fresh account through the API. Never reuses existing data. */
export async function registerAccount(
  request: APIRequestContext,
  opts: { email?: string; accountName?: string } = {},
): Promise<Account> {
  const email = opts.email ?? uniqueEmail();
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password: PASSWORD, account_name: opts.accountName },
  });
  expect(res.status(), `register ${email}: ${await res.text()}`).toBe(201);
  const body = await res.json();
  return {
    email,
    password: PASSWORD,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user.id,
    accountId: body.account.id,
  };
}

export function jwtHeaders(account: Pick<Account, "accessToken">) {
  return { Authorization: `Bearer ${account.accessToken}` };
}

export function keyHeaders(key: string) {
  return { "X-API-Key": key };
}

/** POST /api/apikeys with a JWT. Returns the one-time secret plus metadata. */
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
 * Seed the browser session with API-issued tokens (fast path for dashboard
 * tests). The app reads them from localStorage on hydration. Must be called
 * after the page is on the app origin (localStorage is origin-scoped).
 */
export async function seedSession(page: Page, account: Account): Promise<void> {
  await page.goto("/login");
  await page.evaluate(
    ([ak, rk, at, rt]) => {
      localStorage.setItem(ak, at);
      localStorage.setItem(rk, rt);
    },
    [ACCESS_KEY, REFRESH_KEY, account.accessToken, account.refreshToken] as const,
  );
}

/** Log in through the real /login form. */
export async function loginViaUi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
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
