/**
 * Minimal typed HTTP client for the 3m4 REST API.
 *
 * Deliberately dependency-free (global `fetch`) so the MCP server stays small
 * and the client can be swapped for a fake in tests.
 */
import type {
  AuditEvent,
  CreateLinkInput,
  KeyInfo,
  Link,
  LinkAnalytics,
  Overview,
  Paginated,
  Range,
  UpdateLinkInput,
  Usage,
} from "./types.js";
import { VERSION } from "./version.js";

/** An error the API returned on purpose (`{ error: { code, message } }`). */
export class M4ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "M4ApiError";
  }
}

export interface M4ClientOptions {
  /** Base URL including the `/api` prefix, e.g. `https://3m4.net/api`. */
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | undefined>;

export class M4Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: M4ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      Accept: "application/json",
      "User-Agent": `3m4-mcp/${VERSION}`,
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = ((data as { error?: Record<string, unknown> } | null)?.error ?? {}) as Record<
        string,
        unknown
      >;
      const { code, message, ...extra } = err;
      throw new M4ApiError(
        res.status,
        typeof code === "string" ? code : `http_${res.status}`,
        typeof message === "string" ? message : `HTTP ${res.status}`,
        extra,
      );
    }
    return data as T;
  }

  /** Identity + scopes of the calling key. */
  me(): Promise<KeyInfo> {
    return this.request("GET", "/apikeys/me");
  }

  listLinks(params: { page?: number; per_page?: number; q?: string } = {}): Promise<Paginated<Link>> {
    return this.request("GET", "/links", { query: params });
  }

  createLink(input: CreateLinkInput): Promise<Link> {
    return this.request("POST", "/links", { body: input });
  }

  getLink(id: string): Promise<Link> {
    return this.request("GET", `/links/${encodeURIComponent(id)}`);
  }

  updateLink(id: string, patch: UpdateLinkInput): Promise<Link> {
    return this.request("PATCH", `/links/${encodeURIComponent(id)}`, { body: patch });
  }

  deleteLink(id: string): Promise<void> {
    return this.request("DELETE", `/links/${encodeURIComponent(id)}`);
  }

  linkAnalytics(id: string, range: Range = "7d"): Promise<LinkAnalytics> {
    return this.request("GET", `/links/${encodeURIComponent(id)}/analytics`, { query: { range } });
  }

  usage(): Promise<Usage> {
    return this.request("GET", "/account/usage");
  }

  overview(range: Range = "7d"): Promise<Overview> {
    return this.request("GET", "/analytics/overview", { query: { range } });
  }

  auditLog(params: { limit?: number; action?: string } = {}): Promise<{ items: AuditEvent[] }> {
    return this.request("GET", "/account/audit", { query: params });
  }
}
