import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { initAnalytics } from "../lib/analytics";
import { api } from "../lib/api";
import { BuildingState } from "../components/building-state";
import { FLAG_DEFAULTS } from "../lib/flags";

/**
 * Root layout — initializes PostHog once and enforces the `site-building`
 * curtain: while the flag is ON, every web route renders the building page
 * instead of the app (the redirect service is separate and unaffected).
 *
 * Rendering is held until the flag is known so the real site never flashes
 * behind the curtain. On any error we fall back to the registry default
 * (false = site open) — the curtain must never be able to take the site down
 * by accident.
 */
export default component$(() => {
  // null = unknown (still fetching); boolean = resolved.
  const building = useSignal<boolean | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    initAnalytics();
    try {
      const res = await api.flags();
      building.value =
        res.flags["site-building"] ?? FLAG_DEFAULTS["site-building"];
    } catch {
      building.value = FLAG_DEFAULTS["site-building"];
    }
  });

  if (building.value === null) {
    return <div class="min-h-screen bg-slate-50" />;
  }
  return building.value ? <BuildingState /> : <Slot />;
});
