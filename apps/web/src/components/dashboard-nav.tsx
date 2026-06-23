import { component$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import { Logo } from "./logo";
import { getRefreshToken, clearTokens } from "../lib/auth";
import { api } from "../lib/api";
import { resetAnalytics } from "../lib/analytics";

const items = [
  { href: "/dashboard", label: "Links" },
  { href: "/dashboard/settings", label: "API keys" },
  { href: "/dashboard/billing", label: "Billing" },
];

export const DashboardNav = component$(() => {
  const loc = useLocation();
  const nav = useNavigate();

  const logout = $(async () => {
    const rt = getRefreshToken();
    if (rt) {
      try {
        await api.logout(rt);
      } catch {
        /* best-effort */
      }
    }
    clearTokens();
    resetAnalytics();
    await nav("/login");
  });

  const path = loc.url.pathname.replace(/\/$/, "") || "/dashboard";

  return (
    <header class="border-b border-slate-200 bg-white">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-8">
          <Logo href="/dashboard" />
          <div class="hidden items-center gap-1 md:flex">
            {items.map((it) => {
              const active =
                path === it.href ||
                (it.href === "/dashboard" && path.startsWith("/dashboard/links"));
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  class={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100",
                  ]}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
        <button type="button" class="btn-secondary" onClick$={logout}>
          Log out
        </button>
      </nav>
    </header>
  );
});
