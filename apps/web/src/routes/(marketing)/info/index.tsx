import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../lib/flags";

const pages = [
  { href: "/info/pricing", title: "Pricing", body: "Plans, limits, and prices." },
  { href: "/info/docs", title: "Docs", body: "Guides and API reference (coming soon)." },
  { href: "/info/terms", title: "Terms", body: "Terms of service (coming soon)." },
  { href: "/info/privacy", title: "Privacy", body: "We never store raw IPs (coming soon)." },
];

export default component$(() => {
  const flags = useContext(FlagsContext);
  const early = flags["early-access"];
  return (
    <div class="mx-auto max-w-4xl px-4 py-16">
      <h1 class="text-3xl font-bold text-slate-900">Info</h1>
      <p class="mt-2 text-slate-600">
        Reference pages for 3m4. More will land here over time.
      </p>
      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        {pages.map((p) => (
          <Link key={p.href} href={p.href} class="card p-5 hover:border-primary-300">
            <h2 class="font-semibold text-slate-900">
              {early && p.href === "/info/pricing" ? "Planned pricing" : p.title}
            </h2>
            <p class="mt-1 text-sm text-slate-600">
              {early && p.href === "/info/pricing"
                ? "The tiers we intend to introduce after early access."
                : p.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
});

export const head: DocumentHead = { title: "Info — 3m4" };
