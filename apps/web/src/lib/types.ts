/** Shared API shapes (mirror of CONTRACT.md). */

/** The local mirror of an accounts.3m4.net identity (see CONTRACT.md "Auth"). */
export interface User {
  id: string;
  identity_id: string;
  email: string;
  email_verified: boolean;
  handle: string;
  name: string | null;
  avatar_url: string | null;
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

export interface MeResponse {
  user: User;
  account: Account;
  plan?: string;
  limits: Limits;
  usage: Usage;
  /** Resolved feature flags for this account (backend is source of truth). */
  flags?: Record<string, boolean>;
}

/** `GET /api/billing/status`: the plan + the subscription mirrored from payments.3m4.net. */
export interface BillingSubscription {
  id: string | null;
  entitlement: string | null;
  product: string | null;
  period: "monthly" | "annual" | null;
  /** Stripe status as relayed by payments: active | trialing | past_due | canceled | ... */
  status: string;
  active: boolean;
  current_period_end: string | null;
  will_renew: boolean;
  updated_at: string | null;
}

export interface BillingStatus {
  plan: Account["plan"];
  label: string;
  subscription: BillingSubscription | null;
  payments_url: string;
  app: string;
  price_keys: Partial<Record<Account["plan"], Record<string, string>>>;
}

/** One row of `GET {PAYMENTS_URL}/api/public/supporters?app=3m4`. */
export interface Supporter {
  display_name: string;
  handle: string | null;
  tier: "supporter" | "pro" | "team";
  /** `YYYY-MM` */
  since: string;
  message: string | null;
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
  /** `uniques` is null when the backend does not track them (privacy). */
  summary: { clicks: number; uniques: number | null };
  series: SeriesPoint[];
  by_country: Breakdown[];
  by_device: Breakdown[];
  by_referrer: Breakdown[];
}

export type ApiKeyRole = "viewer" | "editor" | "admin";

export interface ApiKey {
  id: string;
  name?: string;
  prefix: string;
  role: ApiKeyRole;
  last_used_at?: string | null;
  created_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  which?: string;
}
