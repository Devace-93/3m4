import {
  component$,
  Slot,
  useContextProvider,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { initAnalytics } from "../lib/analytics";
import { BuildingState } from "../components/building-state";
import { FlagsContext, type FeatureFlags } from "../lib/flags";
import { fetchServerFlags } from "../lib/flags.server";

/**
 * Root layout — resolves the public feature flags on the server for every
 * route (marketing pages read them through FlagsContext; the dashboard layout
 * re-provides account-targeted flags from /auth/me), initializes PostHog once,
 * and enforces the `site-building` curtain: while that flag is ON, every web
 * route renders the building page instead of the app (the redirect service is
 * separate and unaffected).
 *
 * Resolving on the server means the SSR HTML already reflects the flags, so
 * neither the real site nor a gated section flashes and the first paint is
 * never blank. On any error the loader falls back to the registry defaults —
 * flag resolution must never be able to take the site down by accident.
 */
export const useServerFlags = routeLoader$<FeatureFlags>(() => fetchServerFlags());

export default component$(() => {
  const serverFlags = useServerFlags();
  const flags = useStore<FeatureFlags>({ ...serverFlags.value });
  useContextProvider(FlagsContext, flags);

  // Keep the store in sync when the loader re-runs on client-side navigation.
  useTask$(({ track }) => {
    Object.assign(flags, track(() => serverFlags.value));
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    initAnalytics();
  });

  return flags["site-building"] ? <BuildingState /> : <Slot />;
});
