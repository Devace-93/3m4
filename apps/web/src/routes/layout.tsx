import { component$, Slot, useVisibleTask$ } from "@builder.io/qwik";
import { initAnalytics } from "../lib/analytics";

/**
 * Root layout — pass-through. Per-section chrome lives in the grouped layouts
 * (marketing) / (auth) / (dashboard). We only initialize PostHog here, once,
 * for the whole app (no-ops when VITE_POSTHOG_KEY is unset).
 */
export default component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    initAnalytics();
  });
  return <Slot />;
});
