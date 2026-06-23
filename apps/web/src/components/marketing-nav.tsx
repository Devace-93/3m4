import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { Logo } from "./logo";

export const MarketingNav = component$(() => {
  return (
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <div class="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/info/pricing" class="hover:text-primary-600">
            Pricing
          </Link>
          <Link href="/blog" class="hover:text-primary-600">
            Blog
          </Link>
          <Link href="/projects" class="hover:text-primary-600">
            Projects
          </Link>
          <Link href="/sponsors" class="hover:text-primary-600">
            Sponsors
          </Link>
        </div>
        <div class="flex items-center gap-2">
          <Link href="/login" class="btn-ghost hidden sm:inline-flex">
            Log in
          </Link>
          <Link href="/signup" class="btn-primary">
            Sign up free
          </Link>
        </div>
      </nav>
    </header>
  );
});
