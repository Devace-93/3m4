import { component$, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { PLANS, fmtLimit, fmtPrice, fmtRetention } from "../../../../lib/plans";
import { api } from "../../../../lib/api";
import { capture } from "../../../../lib/analytics";

// Self-host builds set VITE_BILLING_ENABLED=false → hide all purchase UI.
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED !== "false";

const PAID = ["pro", "team"] as const;

export default component$(() => {
  const state = useStore({
    annual: false,
    plan: "free",
    accountId: "",
    notice: "",
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    capture("paywall_viewed");
    api
      .me()
      .then((me) => {
        state.plan = me.account.plan;
        state.accountId = me.account.id;
      })
      .catch(() => {});
  });

  const upgrade = $((plan: "pro" | "team") => {
    capture("checkout_started", {
      plan,
      period: state.annual ? "annual" : "monthly",
    });
    // TODO(billing): launch RevenueCat Web SDK checkout here.
    //   import Purchases from "@revenuecat/purchases-js";
    //   const purchases = Purchases.configure(
    //     import.meta.env.VITE_REVENUECAT_PUBLIC_KEY,
    //     state.accountId,            // app_user_id MUST be the account id
    //   );
    //   const offerings = await purchases.getOfferings();
    //   const pkg = offerings.all[plan].availablePackages.find(
    //     (p) => p.packageType === (state.annual ? "ANNUAL" : "MONTHLY"),
    //   );
    //   await purchases.purchase({ rcPackage: pkg });
    //   // Entitlement granted ("pro" | "team"); backend webhook flips accounts.plan.
    state.notice = `Checkout for the ${PLANS[plan].label} (${
      state.annual ? "annual" : "monthly"
    }) plan is not wired up yet. RevenueCat integration is a TODO.`;
  });

  if (!BILLING_ENABLED) {
    return (
      <div class="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">Billing</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            This is a self-hosted instance.
          </p>
          <p class="mt-2 text-sm">
            Billing is disabled (<code>VITE_BILLING_ENABLED=false</code>). All
            limits come from your configuration — there are no plans to purchase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="mx-auto max-w-4xl px-4 py-12">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-slate-900">Upgrade your plan</h1>
        <p class="mt-2 text-slate-600">
          You're on the <span class="font-semibold capitalize">{state.plan}</span>{" "}
          plan. Unlock more links, clicks, domains, and longer retention.
        </p>
      </div>

      {/* Monthly / annual toggle */}
      <div class="mt-6 flex items-center justify-center gap-3">
        <span class={state.annual ? "text-slate-400" : "font-medium text-slate-900"}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={state.annual}
          class={[
            "relative h-6 w-11 rounded-full transition",
            state.annual ? "bg-primary-600" : "bg-slate-300",
          ]}
          onClick$={() => (state.annual = !state.annual)}
        >
          <span
            class={[
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
              state.annual ? "left-[22px]" : "left-0.5",
            ]}
          />
        </button>
        <span class={state.annual ? "font-medium text-slate-900" : "text-slate-400"}>
          Annual <span class="text-xs text-green-600">(save ~20%)</span>
        </span>
      </div>

      {state.notice && (
        <div class="mx-auto mt-6 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          {state.notice}
        </div>
      )}

      <div class="mt-8 grid gap-6 sm:grid-cols-2">
        {PAID.map((key) => {
          const plan = PLANS[key];
          const price = state.annual ? plan.price_annual : plan.price_monthly;
          const current = state.plan === key;
          return (
            <div
              key={key}
              class={[
                "card flex flex-col p-6",
                key === "pro" ? "ring-2 ring-primary-600" : "",
              ]}
            >
              <h2 class="text-lg font-semibold text-slate-900">{plan.label}</h2>
              <div class="mt-2 flex items-baseline gap-1">
                <span class="text-3xl font-bold text-slate-900">
                  {fmtPrice(price)}
                </span>
                <span class="text-sm text-slate-500">
                  /{state.annual ? "yr" : "mo"}
                </span>
              </div>
              <ul class="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                <li>{fmtLimit(plan.links_per_month)} links / mo</li>
                <li>{fmtLimit(plan.tracked_clicks_per_month)} tracked clicks / mo</li>
                <li>{fmtLimit(plan.custom_domains)} custom domains</li>
                <li>{fmtRetention(plan.retention_days)} retention</li>
                <li>{fmtLimit(plan.max_users)} users</li>
              </ul>
              <button
                type="button"
                class={current ? "btn-secondary mt-6" : "btn-primary mt-6"}
                disabled={current}
                onClick$={() => upgrade(key)}
              >
                {current ? "Current plan" : `Upgrade to ${plan.label.split(" ")[0]}`}
              </button>
            </div>
          );
        })}
      </div>

      <p class="mt-6 text-center text-xs text-slate-400">
        Payments are processed by RevenueCat (Stripe). Entitlements{" "}
        <code>pro</code> / <code>team</code> map to your plan automatically.
      </p>
    </div>
  );
});

export const head: DocumentHead = { title: "Billing — 3m4" };
