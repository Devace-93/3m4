/** Wire types of the 3m4 REST API (see CONTRACT.md at the repo root). */

export type Role = "viewer" | "editor" | "admin";

export type Scope =
  | "links:read"
  | "links:write"
  | "links:delete"
  | "analytics:read"
  | "usage:read"
  | "audit:read";

export interface Link {
  id: string;
  short_code: string;
  short_url: string;
  destination_url: string;
  redirect_type: 301 | 302;
  title: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  click_count: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface KeyInfo {
  account: { id: string; name: string; plan: string; created_at: string };
  key: { id: string; prefix: string; role: Role };
  scopes: Scope[];
}

export interface Usage {
  period_start: string;
  period_end: string;
  links_created: number;
  tracked_clicks: number;
  limits: Record<string, unknown>;
}

export interface Bucket {
  key: string;
  count: number;
}

export interface LinkAnalytics {
  summary: { clicks: number; uniques: number | null };
  series: { date: string; count: number }[];
  by_country: Bucket[];
  by_device: Bucket[];
  by_referrer: Bucket[];
}

export interface Overview {
  range_days: number;
  summary: { clicks: number; links: number };
  series: { date: string; count: number }[];
  top_links: {
    id: string;
    short_code: string;
    short_url: string;
    title: string | null;
    clicks: number;
  }[];
}

export interface AuditEvent {
  id: string;
  ts: string;
  actor_type: string;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: string;
  meta: Record<string, unknown>;
}

export type Range = "7d" | "30d" | "1y";

export interface CreateLinkInput {
  destination_url: string;
  custom_slug?: string;
  redirect_type?: 301 | 302;
  title?: string;
  expires_at?: string;
}

export interface UpdateLinkInput {
  destination_url?: string;
  title?: string;
  active?: boolean;
  redirect_type?: 301 | 302;
  expires_at?: string | null;
}
