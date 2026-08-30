/** Shared API shapes (mirror of CONTRACT.md). */

export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface Account {
  id: string;
  name: string;
  plan: "free" | "pro" | "team" | "enterprise" | "selfhost";
  created_at?: string;
}

export interface Limits {
  links_per_month: number;
  tracked_clicks_per_month: number;
  custom_slugs: boolean;
  custom_domains: number;
  retention_days: number;
  max_users: number;
  api?: string;
}

export interface Usage {
  period_start?: string;
  period_end?: string;
  links_created: number;
  tracked_clicks: number;
  limits?: Limits;
}

export interface AuthResponse {
  user: User;
  account: Account;
  access_token: string;
  refresh_token: string;
}

export interface MeResponse {
  user: User;
  account: Account;
  plan?: string;
  limits: Limits;
  usage: Usage;
  /** Resolved feature flags for this account (backend is source of truth). */
  flags?: Record<string, boolean>;
}

export interface Link {
  id: string;
  short_code: string;
  short_url: string;
  destination_url: string;
  redirect_type: 301 | 302;
  title?: string | null;
  active: boolean;
  expires_at?: string | null;
  created_at: string;
  click_count: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface SeriesPoint {
  date: string;
  count: number;
}

export interface Breakdown {
  key: string;
  count: number;
}

export interface Analytics {
  summary: { clicks: number; uniques: number };
  series: SeriesPoint[];
  by_country: Breakdown[];
  by_device: Breakdown[];
  by_referrer: Breakdown[];
}

export interface ApiKey {
  id: string;
  name?: string;
  prefix: string;
  last_used_at?: string | null;
  created_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  which?: string;
}
