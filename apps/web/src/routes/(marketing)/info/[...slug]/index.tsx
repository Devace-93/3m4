import { component$, useContext } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { PricingTable } from "../../../../components/pricing-table";
import { FlagsContext } from "../../../../lib/flags";
import { tr, useI18n } from "../../../../i18n";

/**
 * Catch-all info section. Today it renders a real /info/pricing view and a
 * generic placeholder for any other slug (docs, terms, …) — future pages drop
 * in here without new routes.
 */
export default component$(() => {
  const loc = useLocation();
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
  const slug = (loc.params.slug || "").replace(/\/$/, "");

  if (slug === "pricing") {
    const early = flags["early-access"];
    return (
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-slate-900">
            {early ? tr(i18n, "pricing.titlePlanned") : tr(i18n, "pricing.title")}
          </h1>
          <p class="mx-auto mt-3 max-w-2xl text-slate-600">
            {early ? tr(i18n, "pricing.introPlanned") : tr(i18n, "pricing.intro")}
          </p>
        </div>

        {early && (
          <div class="mx-auto mt-8 max-w-3xl rounded-xl border border-primary-200 bg-primary-50 p-6 text-center" data-testid="early-access-pricing">
            <p class="text-lg font-semibold text-primary-900">
              {tr(i18n, "pricing.earlyTitle")}
            </p>
            <p class="mt-2 text-sm text-primary-900/80">
              {tr(i18n, "pricing.earlyBody")}
            </p>
            <Link href="/blog/what-paid-plans-will-include" class="btn-primary mt-4">
              {tr(i18n, "pricing.earlyCta")}
            </Link>
          </div>
        )}

        <div class="mt-12">
          <PricingTable />
        </div>

        <div class="mt-10 card bg-primary-50 p-6 text-center">
          <h2 class="text-lg font-semibold text-slate-900">
            {tr(i18n, "pricing.enterpriseTitle")}
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            {tr(i18n, "pricing.enterpriseBody")}
          </p>
          <a
            href="mailto:enrique@3m4.net?subject=3m4%20Enterprise"
            class="btn-primary mt-4"
          >
            {tr(i18n, "pricing.contactUs")}
          </a>
        </div>

        <p class="mt-8 text-center text-sm text-slate-500">
          {tr(i18n, "pricing.footnote")}
          {early && ` ${tr(i18n, "pricing.footnoteEarly")}`}
        </p>
      </div>
    );
  }

  // Generic placeholder for any other /info/* page.
  const title = slug
    ? slug.split("/")[0].replace(/-/g, " ")
    : tr(i18n, "info.title");
  return (
    <div class="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold capitalize text-slate-900">{title}</h1>
      <p class="mt-3 text-slate-600">{tr(i18n, "info.comingSoon")}</p>
      <Link href="/info" class="btn-secondary mt-6">
        {tr(i18n, "info.backToInfo")}
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
