import {
  component$,
  Slot,
  useContextProvider,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { DashboardNav } from "../../components/dashboard-nav";
import { Footer } from "../../components/footer";
import { isAuthenticated } from "../../lib/auth";
import { api } from "../../lib/api";
import { FlagsContext, FLAG_DEFAULTS, mergeFlags } from "../../lib/flags";

/**
 * Authed area chrome + route guard. Tokens live only in the browser, so the
 * guard runs client-side: unauthenticated visitors are redirected to /login and
 * protected content is never rendered for them.
 *
 * Also resolves feature flags (from /auth/me) BEFORE rendering children, so
 * gated pages never flicker. On any error we fall back to the shared-registry
 * defaults — flag resolution must never lock a user out of the dashboard.
 */
export default component$(() => {
  const nav = useNavigate();
  const ready = useSignal(false);
  const flags = useStore({ ...FLAG_DEFAULTS });
  useContextProvider(FlagsContext, flags);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    if (!isAuthenticated()) {
      nav("/login");
      return;
    }
    try {
      const me = await api.me();
      Object.assign(flags, mergeFlags(me.flags));
    } catch {
      /* keep defaults; pages surface their own load errors */
    }
    ready.value = true;
  });

  return (
    <div class="flex min-h-screen flex-col bg-slate-50">
      <DashboardNav />
      <main class="flex-1">
        {ready.value ? (
          <Slot />
        ) : (
          <div class="grid place-items-center py-24 text-sm text-slate-400">
            Loading…
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
});
