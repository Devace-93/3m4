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

import { translate, type I18nState } from "../i18n";

function locale(i18n?: I18nState): string {
  return i18n?.lang ?? "en-US";
}

/** Format a numeric limit; -1 means unlimited. */
export function fmtLimit(n: number, i18n?: I18nState): string {
  if (n < 0) return i18n ? translate(i18n, "plans.unlimited") : "Unlimited";
  return n.toLocaleString(locale(i18n));
}

/** Format a USD price; -1 means custom. */
export function fmtPrice(n: number, i18n?: I18nState): string {
  if (n < 0) return i18n ? translate(i18n, "plans.custom") : "Custom";
  if (n === 0) return "$0";
  return `$${n.toLocaleString(locale(i18n))}`;
}

/** Human label for the retention window. */
export function fmtRetention(days: number, i18n?: I18nState): string {
  if (days < 0) return fmtLimit(days, i18n);
  if (days % 365 === 0) {
    const y = days / 365;
    if (i18n) return translate(i18n, y > 1 ? "plans.years" : "plans.year", { n: y });
    return `${y} year${y > 1 ? "s" : ""}`;
  }
  return i18n ? translate(i18n, "plans.days", { n: days }) : `${days} days`;
}
