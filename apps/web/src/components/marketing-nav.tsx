import { component$, useContext, useSignal, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import { Logo } from "./logo";
import { clearTokens, getRefreshToken, isAuthenticated } from "../lib/auth";
import { api } from "../lib/api";
import { resetAnalytics } from "../lib/analytics";
import { FlagsContext } from "../lib/flags";

/**
 * Public nav. Tokens live in the browser only, so the signed-in state is
 * resolved client-side after hydration: until then neither button set is
 * rendered, which avoids a "Log in" flash for a signed-in visitor.
 */
export const MarketingNav = component$(() => {
  const nav = useNavigate();
  const loc = useLocation();
  const flags = useContext(FlagsContext);
  // null = unknown (SSR / before hydration), boolean = resolved.
  const authed = useSignal<boolean | null>(null);
  const menuOpen = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    authed.value = isAuthenticated();
  });

  // Close the mobile menu whenever the route changes.
  useTask$(({ track }) => {
    track(() => loc.url.pathname);
    menuOpen.value = false;
  });

  const links = [
    ...(!flags["early-access"] ? [{ href: "/info/pricing", label: "Pricing" }] : []),
    { href: "/blog", label: "Blog" },
    ...(flags.projects ? [{ href: "/projects", label: "Projects" }] : []),
    { href: "/sponsors", label: "Sponsors" },
  ];

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
    authed.value = false;
    await nav("/");
  });

  return (
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <div class="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} class="hover:text-primary-600">
              {l.label}
            </Link>
          ))}
        </div>
        <div class="flex min-h-[2.5rem] items-center gap-2" data-auth-state={String(authed.value)}>
          {authed.value === true && (
            <>
              <button type="button" class="btn-ghost hidden md:inline-flex" onClick$={logout}>
                Log out
              </button>
              <Link href="/dashboard" class="btn-primary">
                Dashboard
              </Link>
            </>
          )}
          {authed.value === false && (
            <>
              <Link href="/login" class="btn-ghost hidden md:inline-flex">
                Log in
              </Link>
              <Link href="/signup" class="btn-primary">
                Sign up free
              </Link>
            </>
          )}
          {/* Mobile menu toggle */}
          <button
            type="button"
            class="btn-ghost -mr-2 px-2 md:hidden"
            aria-label={menuOpen.value ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen.value}
            aria-controls="mobile-menu"
            onClick$={() => (menuOpen.value = !menuOpen.value)}
          >
            {menuOpen.value ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      <div
        id="mobile-menu"
        class="border-t border-slate-200 bg-white md:hidden"
        hidden={!menuOpen.value}
      >
        <div class="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              class="rounded-lg px-2 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              {l.label}
            </Link>
          ))}
          <div class="my-2 border-t border-slate-100" />
          {authed.value === true && (
            <>
              <Link href="/dashboard" class="rounded-lg px-2 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
                Dashboard
              </Link>
              <button
                type="button"
                class="rounded-lg px-2 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50"
                onClick$={logout}
              >
                Log out
              </button>
            </>
          )}
          {authed.value === false && (
            <>
              <Link href="/login" class="rounded-lg px-2 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
                Log in
              </Link>
              <Link href="/signup" class="rounded-lg px-2 py-3 text-base font-medium text-primary-600 hover:bg-slate-50">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
});
