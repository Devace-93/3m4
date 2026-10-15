/**
 * Server-side feature flag resolution (SSR only — imported from routeLoader$).
 *
 * The root layout resolves the public flags while rendering so the first paint
 * already shows the right surfaces (no blank page, no gated-section flash, and
 * crawlers see real content). The API is reached directly over the internal
 * network via `API_INTERNAL_URL` (compose: http://api:5000/api); when that is
 * unset we fall back to an absolute `VITE_API_URL`, and when neither is usable
 * — or the API is slow/down — we return the registry defaults so flag
 * resolution can never take the site down.
 */
import { FLAG_DEFAULTS, mergeFlags, type FeatureFlags } from "./flags";

const TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 15_000;

let cached: { flags: FeatureFlags; at: number } | null = null;

function apiBase(): string | null {
  const internal = process.env.API_INTERNAL_URL;
  if (internal) return internal.replace(/\/$/, "");
  const pub = import.meta.env.VITE_API_URL || "";
  if (/^https?:\/\//.test(pub)) return pub.replace(/\/$/, "");
  return null;
}

export async function fetchServerFlags(): Promise<FeatureFlags> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.flags;
  const base = apiBase();
  if (!base) return { ...FLAG_DEFAULTS };
  try {
    const res = await fetch(`${base}/flags`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`flags ${res.status}`);
    const data = (await res.json()) as { flags?: Record<string, boolean> };
    const flags = mergeFlags(data.flags);
    cached = { flags, at: Date.now() };
    return flags;
  } catch {
    return cached?.flags ?? { ...FLAG_DEFAULTS };
  }
}
