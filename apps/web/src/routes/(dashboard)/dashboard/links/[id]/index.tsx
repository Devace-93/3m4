import {
  component$,
  useContext,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import {
  Link,
  useLocation,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { api, qrUrl, ApiRequestError } from "../../../../../lib/api";
import { BarChart } from "../../../../../components/bar-chart";
import { FlagsContext } from "../../../../../lib/flags";
import { tr, useI18n } from "../../../../../i18n";
import type { Analytics, Breakdown, Link as LinkObj } from "../../../../../lib/types";

type Range = "7d" | "30d" | "1y";

const Breakdowns = component$<{ title: string; rows: Breakdown[] }>(
  ({ title, rows }) => {
    const i18n = useI18n();
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <div class="card p-5">
        <h3 class="text-sm font-semibold text-slate-900">{title}</h3>
        {rows.length === 0 ? (
          <p class="mt-3 text-sm text-slate-400">{tr(i18n, "link.noData")}</p>
        ) : (
          <ul class="mt-3 space-y-2">
            {rows.slice(0, 6).map((r) => (
              <li key={r.key}>
                <div class="flex items-center justify-between text-sm">
                  <span class="truncate text-slate-700">{r.key || tr(i18n, "link.unknown")}</span>
                  <span class="text-slate-500">{r.count.toLocaleString()}</span>
                </div>
                <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full bg-primary-500"
                    style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
  const id = loc.params.id;

  const state = useStore<{
    link: LinkObj | null;
    analytics: Analytics | null;
    range: Range;
    loading: boolean;
    error: string;
    copied: boolean;
  }>({
    link: null,
    analytics: null,
    range: "7d",
    loading: true,
    error: "",
    copied: false,
  });

  // Resolved during render so the handler captures a string, not the store.
  const msgLoadFailed = tr(i18n, "link.loadFailed");

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      // Analytics is feature-flagged; the link details themselves are not.
      const [link, analytics] = await Promise.all([
        api.getLink(id),
        flags["analytics-dashboard"]
          ? api.analytics(id, state.range)
          : Promise.resolve(null),
      ]);
      state.link = link;
      state.analytics = analytics;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = e instanceof ApiRequestError ? e.error.message : msgLoadFailed;
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => state.range);
    load();
  });

  const copy = $(async () => {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link.short_url);
      state.copied = true;
      setTimeout(() => (state.copied = false), 1500);
    } catch {
      /* ignore */
    }
  });

  return (
    <div class="mx-auto max-w-6xl px-4 py-8">
      <Link href="/dashboard" class="text-sm text-slate-500 hover:text-primary-600">
        {tr(i18n, "link.back")}
      </Link>

      {state.loading ? (
        <div class="mt-8 card p-10 text-center text-sm text-slate-400">
          {tr(i18n, "common.loading")}
        </div>
      ) : state.error ? (
        <div class="mt-8 card p-10 text-center text-sm text-red-600">
          {state.error}
        </div>
      ) : state.link ? (
        <>
          <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-slate-900">
                {state.link.title || state.link.short_code}
              </h1>
              <div class="mt-1 flex items-center gap-2">
                <a
                  href={state.link.short_url}
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-primary-600 hover:underline"
                >
                  {state.link.short_url}
                </a>
                <button
                  type="button"
                  class="text-xs text-slate-400 hover:text-primary-600"
                  onClick$={copy}
                >
                  {state.copied ? tr(i18n, "common.copied") : tr(i18n, "common.copy")}
                </button>
                <span class="badge bg-slate-100 text-slate-600">
                  {state.link.redirect_type}
                </span>
              </div>
              <p class="mt-1 max-w-xl truncate text-sm text-slate-500">
                → {state.link.destination_url}
              </p>
            </div>

            {/* Range selector */}
            {flags["analytics-dashboard"] && (
            <div class="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              {(["7d", "30d", "1y"] as Range[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  class={[
                    "rounded-md px-3 py-1 text-sm font-medium",
                    state.range === r
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  ]}
                  onClick$={() => (state.range = r)}
                >
                  {r}
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Summary + chart */}
          <div class="mt-6 grid gap-6 lg:grid-cols-3">
            {!flags["analytics-dashboard"] ? (
              <div class="card p-6 text-center lg:col-span-2">
                <p class="font-medium text-slate-800">
                  {tr(i18n, "link.analyticsUnavailableTitle")}
                </p>
                <p class="mt-1 text-sm text-slate-500">
                  {tr(i18n, "link.analyticsUnavailableBody")}
                </p>
              </div>
            ) : (
            <div class="card p-6 lg:col-span-2">
              <div class="flex items-center gap-8">
                <div>
                  <div class="text-3xl font-bold text-slate-900">
                    {(state.analytics?.summary.clicks ?? 0).toLocaleString()}
                  </div>
                  <div class="text-xs uppercase tracking-wide text-slate-400">
                    {tr(i18n, "common.clicks")}
                  </div>
                </div>
                {typeof state.analytics?.summary.uniques === "number" && (
                  <div>
                    <div class="text-3xl font-bold text-slate-900">
                      {state.analytics.summary.uniques.toLocaleString()}
                    </div>
                    <div class="text-xs uppercase tracking-wide text-slate-400">
                      {tr(i18n, "link.uniques")}
                    </div>
                  </div>
                )}
              </div>
              <div class="mt-6">
                <BarChart series={state.analytics?.series ?? []} />
              </div>
            </div>
            )}

            {/* QR */}
            <div class="card flex flex-col items-center p-6">
              <h3 class="self-start text-sm font-semibold text-slate-900">
                {tr(i18n, "link.qrCode")}
              </h3>
              <img
                src={qrUrl(state.link.short_code, 512)}
                alt={tr(i18n, "link.qrAlt", { url: state.link.short_url })}
                width={180}
                height={180}
                class="mt-4 h-44 w-44 rounded-lg border border-slate-200"
              />
              <a
                href={qrUrl(state.link.short_code, 1024)}
                download={`${state.link.short_code}-qr.png`}
                class="btn-secondary mt-4 w-full"
              >
                {tr(i18n, "link.downloadPng")}
              </a>
            </div>
          </div>

          {/* Breakdowns */}
          {flags["analytics-dashboard"] && (
            <div class="mt-6 grid gap-6 md:grid-cols-3">
              <Breakdowns
                title={tr(i18n, "link.byCountry")}
                rows={state.analytics?.by_country ?? []}
              />
              <Breakdowns
                title={tr(i18n, "link.byDevice")}
                rows={state.analytics?.by_device ?? []}
              />
              <Breakdowns
                title={tr(i18n, "link.byReferrer")}
                rows={state.analytics?.by_referrer ?? []}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
});

export const head: DocumentHead = { title: "Link analytics — 3m4" };
