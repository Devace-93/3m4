/**
 * API client for the 3m4 Flask backend.
 *
 * - Base URL from VITE_API_URL (fallback "/api" — works behind Caddy).
 * - Credentials included: the accounts `3m4_session` cookie IS the login
 *   (no bearer tokens in the browser).
 * - On `401 session_expired` it refreshes once against accounts and retries;
 *   on `401 no_session` / `invalid_session` it sends the visitor to the hosted
 *   login page and rejects.
 *
 * Throws `ApiRequestError` (carrying the parsed `error` body + HTTP status) so
 * callers can branch on e.g. 402 limit_reached or 403 email_unverified.
 */
import { loginUrl, session } from "./auth";
import type {
  Analytics,
  ApiError,
  ApiKey,
  ApiKeyRole,
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
  get isUnverified(): boolean {
    return this.status === 403 && this.error?.code === "email_unverified";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Public endpoint: a missing session must not trigger the login redirect. */
  auth?: boolean;
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

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  // fetchWithSession: credentials included + one transparent refresh on
  // `401 session_expired`.
  const res = await session.fetchWithSession(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await parseError(res);
    if (res.status === 401 && auth && typeof location !== "undefined") {
      // No usable session (none, invalid, or the refresh failed): go log in.
      session.invalidate();
      location.assign(loginUrl());
    }
    throw new ApiRequestError(res.status, error);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ─── Auth (identity lives at accounts.3m4.net; this is the tenant view) ── */
export const api = {
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
