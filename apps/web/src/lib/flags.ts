/**
 * Feature flags, mirrored from the backend (the source of truth).
 *
 * Registry + fail-safe defaults live in `packages/shared/feature_flags.json`
 * (same pattern as plan_limits.json). Authenticated pages get resolved flags
 * from `/auth/me`; anonymous pages (signup) from `GET /api/flags`. The UI only
 * hides surfaces — enforcement happens in the Flask API.
 */
import { createContextId } from "@builder.io/qwik";
import registry from "../../../../packages/shared/feature_flags.json";

export type FlagKey =
  | "site-building"
  | "signups"
  | "link-creation"
  | "custom-slugs"
  | "analytics-dashboard"
  | "public-api"
  | "billing";

export type FeatureFlags = Record<FlagKey, boolean>;

/** Fail-safe defaults from the shared registry (used until the API answers). */
export const FLAG_DEFAULTS: FeatureFlags = Object.fromEntries(
  Object.entries(registry.flags).map(([k, v]) => [k, v.default]),
) as FeatureFlags;

/** Merge a server-resolved flag map over the defaults. */
export function mergeFlags(server?: Record<string, boolean>): FeatureFlags {
  return { ...FLAG_DEFAULTS, ...(server ?? {}) };
}

/** Provided by the dashboard layout; consume with useContext(FlagsContext). */
export const FlagsContext = createContextId<FeatureFlags>("3m4.flags");
