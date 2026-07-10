import {
  component$,
  useContext,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { PLANS, fmtLimit, fmtPrice, fmtRetention } from "../../../../lib/plans";
import { api } from "../../../../lib/api";
import { capture } from "../../../../lib/analytics";
import { FlagsContext } from "../../../../lib/flags";

// Self-host builds set VITE_BILLING_ENABLED=false → hide all purchase UI.
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED !== "false";

const PAID = ["pro", "team"] as const;

export default component$(() => {
  const flags = useContext(FlagsContext);
  const state = useStore({
    annual: false,
    plan: "free",
    accountId: "",
    notice: "",
    busy: false,
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

  const upgrade = $(async (plan: "pro" | "team") => {
    if (state.busy) return;
    capture("checkout_started", {
      plan,
      period: state.annual ? "annual" : "monthly",
    });

    const apiKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
    if (!apiKey) {
      state.notice =
        "Billing isn't configured yet (missing VITE_REVENUECAT_PUBLIC_KEY). " +
        "Add your RevenueCat Web Billing public key to .env and rebuild the web image.";
      return;
    }

    // RevenueCat's app_user_id MUST be our account id.
    if (!state.accountId) {
      try {
        const me = await api.me();
        state.accountId = me.account.id;
      } catch {
        state.notice = "Please sign in again to upgrade.";
        return;
      }
    }

    state.busy = true;
    state.notice = "Opening secure checkout…";
    try {
      const { Purchases } = await import("@revenuecat/purchases-js");

      // Configure once per app_user_id; reuse the shared instance afterwards.
      let purchases!: InstanceType<typeof Purchases>;
      try {
        purchases = Purchases.getSharedInstance();
      } catch {
        purchases = Purchases.configure({ apiKey, appUserId: state.accountId });
      }

      const offerings = await purchases.getOfferings();
      // The offering identifier matches the plan id ("pro" | "team").
      const offering = offerings.all?.[plan] ?? offerings.current;
      if (!offering) throw new Error(`No RevenueCat offering found for "${plan}".`);

      const pkg = state.annual ? offering.annual : offering.monthly;
      if (!pkg) {
        throw new Error(
          `No ${state.annual ? "annual" : "monthly"} package in the "${plan}" offering.`,
        );
      }

      // Opens RevenueCat's hosted checkout (Stripe under the hood). Resolves on success.
      await purchases.purchase({ rcPackage: pkg });

      // Entitlement is granted immediately; our backend webhook flips
      // accounts.plan asynchronously, so poll /auth/me until it reflects.
      state.notice = "Payment complete — activating your plan…";
      for (let i = 0; i < 12; i++) {
        const me = await api.me();
        if (me.account.plan === plan) {
          state.plan = plan;
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      state.notice =
        state.plan === plan
          ? `You're now on the ${PLANS[plan].label} plan! 🎉`
          : "Payment received — your plan will update momentarily.";
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? "");
      state.notice =
        /cancel/i.test(msg) || err?.errorCode === "UserCancelledError"
          ? "Checkout cancelled."
          : `Checkout failed: ${msg || "unknown error"}`;
    } finally {
      state.busy = false;
    }
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

  if (!flags.billing) {
    return (
      <div class="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">Billing</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            Paid plans aren't available just yet.
          </p>
          <p class="mt-2 text-sm">
            We're rolling out billing gradually. You keep everything in your
            current plan — check back soon.
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
                disabled={current || state.busy}
                onClick$={() => upgrade(key)}
              >
                {current
                  ? "Current plan"
                  : state.busy
                    ? "Processing…"
                    : `Upgrade to ${plan.label.split(" ")[0]}`}
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
