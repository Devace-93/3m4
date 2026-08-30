/**
 * Plan + pricing data. Single source of truth lives in
 * `packages/shared/plan_limits.json` (also consumed by the Python backend);
 * we import it directly so the UI never drifts from enforcement.
 */
import planLimits from "../../../../packages/shared/plan_limits.json";

export interface Plan {
  label: string;
  price_monthly: number;
  price_annual: number;
  links_per_month: number;
  tracked_clicks_per_month: number;
  custom_slugs: boolean;
  custom_domains: number;
  retention_days: number;
  max_users: number;
  api: string;
}

export type PlanKey = "free" | "pro" | "team" | "enterprise" | "selfhost";

export const PLANS = planLimits.plans as Record<PlanKey, Plan>;
export const ENTITLEMENT_TO_PLAN = planLimits.entitlement_to_plan as Record<
  string,
  string
>;

/** Format a numeric limit; -1 means unlimited. */
export function fmtLimit(n: number): string {
  if (n < 0) return "Unlimited";
  return n.toLocaleString("en-US");
}

/** Format a USD price; -1 means custom. */
export function fmtPrice(n: number): string {
  if (n < 0) return "Custom";
  if (n === 0) return "$0";
  return `$${n.toLocaleString("en-US")}`;
}

/** Human label for the retention window. */
export function fmtRetention(days: number): string {
  if (days < 0) return "Unlimited";
  if (days % 365 === 0) {
    const y = days / 365;
    return `${y} year${y > 1 ? "s" : ""}`;
  }
  return `${days} days`;
}
