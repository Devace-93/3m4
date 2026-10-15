import { component$, useContext } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { PLANS, fmtLimit, fmtPrice, fmtRetention, type PlanKey } from "../lib/plans";
import { FlagsContext } from "../lib/flags";

interface Props {
  /** Which plans to show (defaults to the public tiers). */
  keys?: PlanKey[];
  /** Show the annual price instead of monthly. */
  annual?: boolean;
  /** Highlight one plan as the recommended option. */
  highlight?: PlanKey;
}

/**
 * Renders pricing cards from packages/shared/plan_limits.json. While
 * `early-access` is ON the tiers are informational only: no plan can be
 * started yet, so the per-plan CTAs and the "Most popular" badge are hidden.
 */
export const PricingTable = component$<Props>(
  ({ keys = ["free", "pro", "team", "enterprise"], annual = false, highlight = "pro" }) => {
    const flags = useContext(FlagsContext);
    const early = flags["early-access"];
    return (
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => {
          const plan = PLANS[key];
          if (!plan) return null;
          const isEnterprise = key === "enterprise";
          const price = annual ? plan.price_annual : plan.price_monthly;
          const featured = !early && key === highlight;
          return (
            <div
              key={key}
              class={[
                "card flex flex-col p-6",
                featured ? "ring-2 ring-primary-600" : "",
              ]}
            >
              {featured && (
                <span class="badge mb-3 w-fit bg-primary-100 text-primary-700">
                  Most popular
                </span>
              )}
              <h3 class="text-lg font-semibold text-slate-900">{plan.label}</h3>

              <div class="mt-3 flex items-baseline gap-1">
                <span class="text-3xl font-bold text-slate-900">
                  {fmtPrice(price)}
                </span>
                {!isEnterprise && (
                  <span class="text-sm text-slate-500">
                    /{annual ? "yr" : "mo"}
                  </span>
                )}
              </div>

              <ul class="mt-6 flex-1 space-y-2 text-sm text-slate-600">
                <li>
                  <strong>{fmtLimit(plan.links_per_month)}</strong> links / mo
                </li>
                <li>
                  <strong>{fmtLimit(plan.tracked_clicks_per_month)}</strong>{" "}
                  tracked clicks / mo
                </li>
                <li>
                  <strong>{fmtLimit(plan.custom_domains)}</strong> custom domain
                  {plan.custom_domains === 1 ? "" : "s"}
                </li>
                {plan.custom_slugs && <li>Custom slugs</li>}
                <li>{fmtRetention(plan.retention_days)} retention</li>
                <li>
                  <strong>{fmtLimit(plan.max_users)}</strong> user
                  {plan.max_users === 1 ? "" : "s"}
                </li>
                <li class="capitalize">{plan.api} API</li>
                {key === "pro" && <li>/sponsors badge</li>}
                {key === "team" && <li>Roles + priority support</li>}
                {isEnterprise && <li>SSO, SLA, custom limits</li>}
              </ul>

              {(isEnterprise || !early) && (
              <div class="mt-6">
                {isEnterprise ? (
                  <a href="mailto:enrique@3m4.net?subject=3m4%20Enterprise" class="btn-secondary w-full">
                    Contact us
                  </a>
                ) : key === "free" ? (
                  <Link href="/signup" class="btn-secondary w-full">
                    Get started
                  </Link>
                ) : (
                  <Link href="/signup" class="btn-primary w-full">
                    Start {plan.label.split(" ")[0]}
                  </Link>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
