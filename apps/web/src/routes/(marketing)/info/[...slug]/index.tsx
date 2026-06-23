import { component$ } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { PricingTable } from "../../../../components/pricing-table";

/**
 * Catch-all info section. Today it renders a real /info/pricing view and a
 * generic placeholder for any other slug (docs, terms, …) — future pages drop
 * in here without new routes.
 */
export default component$(() => {
  const loc = useLocation();
  const slug = (loc.params.slug || "").replace(/\/$/, "");

  if (slug === "pricing") {
    return (
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-slate-900">Simple, honest pricing</h1>
          <p class="mx-auto mt-3 max-w-2xl text-slate-600">
            Start free. Upgrade when you need more links, clicks, domains, or
            longer retention. Self-host for unlimited everything.
          </p>
        </div>

        <div class="mt-12">
          <PricingTable />
        </div>

        <div class="mt-10 card bg-primary-50 p-6 text-center">
          <h2 class="text-lg font-semibold text-slate-900">
            Need custom limits, SSO, or an SLA?
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            Enterprise plans are tailored to your team.
          </p>
          <a
            href="mailto:enrique@3m4.net?subject=3m4%20Enterprise"
            class="btn-primary mt-4"
          >
            Contact us
          </a>
        </div>

        <p class="mt-8 text-center text-sm text-slate-500">
          All prices in USD. Annual billing saves ~20%. Limits are enforced per
          billing period; over-limit links are blocked, over-limit clicks keep
          redirecting (we just stop counting).
        </p>
      </div>
    );
  }

  // Generic placeholder for any other /info/* page.
  const title = slug
    ? slug.split("/")[0].replace(/-/g, " ")
    : "Info";
  return (
    <div class="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold capitalize text-slate-900">{title}</h1>
      <p class="mt-3 text-slate-600">This page is coming soon.</p>
      <Link href="/info" class="btn-secondary mt-6">
        Back to Info
      </Link>
    </div>
  );
});

export const head: DocumentHead = ({ params }) => {
  const slug = (params.slug || "info").split("/")[0];
  const title = slug === "pricing" ? "Pricing" : slug.replace(/-/g, " ");
  return {
    title: `${title.charAt(0).toUpperCase() + title.slice(1)} — 3m4`,
  };
};
