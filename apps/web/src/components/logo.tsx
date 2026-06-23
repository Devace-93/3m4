import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

/** Wordmark for 3m4 — links home. */
export const Logo = component$<{ href?: string }>(({ href = "/" }) => {
  return (
    <Link href={href} class="flex items-center gap-2 font-bold tracking-tight">
      <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary-600 text-sm font-extrabold text-white">
        3m
      </span>
      <span class="text-lg text-slate-900">
        3m<span class="text-primary-600">4</span>
      </span>
    </Link>
  );
});
