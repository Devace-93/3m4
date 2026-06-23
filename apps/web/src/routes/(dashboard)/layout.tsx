import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { DashboardNav } from "../../components/dashboard-nav";
import { Footer } from "../../components/footer";
import { isAuthenticated } from "../../lib/auth";

/**
 * Authed area chrome + route guard. Tokens live only in the browser, so the
 * guard runs client-side: unauthenticated visitors are redirected to /login and
 * protected content is never rendered for them.
 */
export default component$(() => {
  const nav = useNavigate();
  const ready = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!isAuthenticated()) {
      nav("/login");
      return;
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
