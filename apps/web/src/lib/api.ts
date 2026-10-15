/**
 * API client for the 3m4 Flask backend.
 *
 * - Base URL from VITE_API_URL (fallback "/api" — works behind Caddy).
 * - Attaches the bearer access token.
 * - On a 401, transparently refreshes via POST /auth/refresh (once) and retries.
 *
 * Throws `ApiRequestError` (carrying the parsed `error` body + HTTP status) so
 * callers can branch on e.g. 402 limit_reached.
 */
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from "./auth";
import type {
  Analytics,
  ApiError,
  ApiKey,
  ApiKeyRole,
  AuthResponse,
  Link,
  MeResponse,
  Paginated,
  Usage,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiRequestError extends Error {
  status: number;
  error: ApiError;
  constructor(status: number, error: ApiError) {
    super(error?.message || `Request failed (${status})`);
    this.name = "ApiRequestError";
    this.status = status;
    this.error = error;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching/refreshing the bearer token (e.g. login/register). */
  auth?: boolean;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    if (data?.error) return data.error as ApiError;
    return { code: "error", message: data?.message || res.statusText };
  } catch {
    return { code: "error", message: res.statusText || "Request failed" };
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, _retried = false } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !_retried) {
    const ok = await tryRefresh();
    if (ok) return apiFetch<T>(path, { ...opts, _retried: true });
    clearTokens();
  }

  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ─── Auth ─────────────────────────────────────────────────────────────── */
export const api = {
  register: (email: string, password: string, account_name?: string) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password, account_name },
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    }),

  logout: (refresh_token: string) =>
    apiFetch<void>("/auth/logout", {
      method: "POST",
      body: { refresh_token },
    }),

  me: () => apiFetch<MeResponse>("/auth/me"),

  /* ─── Feature flags (public; anonymous pages like /signup) ──────────── */
  flags: () =>
    apiFetch<{ flags: Record<string, boolean> }>("/flags", { auth: false }),

  /* ─── Links ──────────────────────────────────────────────────────────── */
  listLinks: (page = 1, per_page = 20, q = "") =>
    apiFetch<Paginated<Link>>(
      `/links?page=${page}&per_page=${per_page}` +
        (q ? `&q=${encodeURIComponent(q)}` : ""),
    ),

  createLink: (input: {
    destination_url: string;
    custom_slug?: string;
    redirect_type?: 301 | 302;
    title?: string;
    expires_at?: string;
  }) => apiFetch<Link>("/links", { method: "POST", body: input }),

  getLink: (id: string) => apiFetch<Link>(`/links/${id}`),

  deleteLink: (id: string) =>
    apiFetch<void>(`/links/${id}`, { method: "DELETE" }),

  analytics: (id: string, range: "7d" | "30d" | "1y" = "7d") =>
    apiFetch<Analytics>(`/links/${id}/analytics?range=${range}`),

  /* ─── Account ────────────────────────────────────────────────────────── */
  usage: () => apiFetch<Usage>("/account/usage"),

  /* ─── API keys ───────────────────────────────────────────────────────── */
  listApiKeys: () => apiFetch<ApiKey[]>("/apikeys"),
  createApiKey: (name: string, role: ApiKeyRole = "editor") =>
    apiFetch<{ id: string; key: string; role: ApiKeyRole }>("/apikeys", {
      method: "POST",
      body: { name, role },
    }),
  deleteApiKey: (id: string) =>
    apiFetch<void>(`/apikeys/${id}`, { method: "DELETE" }),
};

/**
 * Absolute URL to a link's QR PNG. Uses the public, unauthenticated route
 * (`/qr/<short_code>.png`): a browser cannot attach the bearer token to an
 * `<img src>`, and the QR only encodes the public short URL anyway.
 */
export function qrUrl(shortCode: string, size = 512): string {
  return `${BASE}/qr/${encodeURIComponent(shortCode)}.png?size=${size}`;
}
