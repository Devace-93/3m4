import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../lib/flags";
import { tr, useI18n } from "../../i18n";
import { PLANS, fmtLimit } from "../../lib/plans";

const MCP_SNIPPET = "claude mcp add 3m4 --scope user --env M4_API_KEY=m4_live_… -- npx -y 3m4-mcp";
const MCP_REMOTE_SNIPPET =
  'claude mcp add --transport http 3m4 https://3m4.net/mcp --header "Authorization: Bearer m4_live_…"';
const MCP_NPM_URL = "https://www.npmjs.com/package/3m4-mcp";

export default component$(() => {
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
  const early = flags["early-access"];
  const features = [
    { title: tr(i18n, "landing.feature1Title"), body: tr(i18n, "landing.feature1Body") },
    { title: tr(i18n, "landing.feature2Title"), body: tr(i18n, "landing.feature2Body") },
    { title: tr(i18n, "landing.feature3Title"), body: tr(i18n, "landing.feature3Body") },
    { title: tr(i18n, "landing.feature4Title"), body: tr(i18n, "landing.feature4Body") },
    { title: tr(i18n, "landing.feature5Title"), body: tr(i18n, "landing.feature5Body") },
    { title: tr(i18n, "landing.feature6Title"), body: tr(i18n, "landing.feature6Body") },
    { title: tr(i18n, "landing.feature7Title"), body: tr(i18n, "landing.feature7Body") },
  ];
  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-primary-50 to-white">
        <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <span class="badge mb-5 bg-primary-100 text-primary-700">
            {tr(i18n, "landing.badge")}
          </span>
          <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {tr(i18n, "landing.heroTitle")}{" "}
            <span class="text-primary-600">{tr(i18n, "landing.heroTitleAccent")}</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            {tr(i18n, "landing.heroBody")}
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" class="btn-primary px-6 py-3 text-base">
              {tr(i18n, "landing.getStarted")}
            </Link>
            {early ? (
              <Link
                href="/blog/what-paid-plans-will-include"
                class="btn-secondary px-6 py-3 text-base"
              >
                {tr(i18n, "landing.whyFree")}
              </Link>
            ) : (
              <Link
                href="/info/pricing"
                class="btn-secondary px-6 py-3 text-base"
              >
                {tr(i18n, "landing.seePricing")}
              </Link>
            )}
          </div>
          <p class="mt-4 text-sm text-slate-500" data-testid="hero-plan-note">
            {early
              ? tr(i18n, "landing.earlyNote")
              : tr(i18n, "landing.freeNote", {
                  links: fmtLimit(PLANS.free.links_per_month, i18n),
                  clicks: fmtLimit(PLANS.free.tracked_clicks_per_month, i18n),
                })}
          </p>
        </div>
      </section>

      {/* Features */}
      <section class="mx-auto max-w-6xl px-4 py-16">
        <h2 class="text-center text-3xl font-bold text-slate-900">
          {tr(i18n, "landing.featuresTitle")}
        </h2>
        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} class="card p-6">
              <h3 class="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p class="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP */}
      <section class="border-y border-slate-200 bg-slate-50" id="mcp">
        <div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <span class="badge bg-primary-100 text-primary-700">{tr(i18n, "landing.mcpBadge")}</span>
            <h2 class="mt-4 text-3xl font-bold text-slate-900">
              {tr(i18n, "landing.mcpTitle")}
            </h2>
            <p class="mt-3 text-slate-600">
              {tr(i18n, "landing.mcpIntro")}{" "}
              <em>{tr(i18n, "landing.mcpExample1")}</em> {tr(i18n, "landing.mcpOr")}{" "}
              <em>{tr(i18n, "landing.mcpExample2")}</em>
            </p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li>
                <strong>{tr(i18n, "landing.mcpBullet1Title")}</strong> {tr(i18n, "landing.mcpBullet1Body")}
              </li>
              <li>
                <strong>{tr(i18n, "landing.mcpBullet2Title")}</strong> {tr(i18n, "landing.mcpBullet2Body")}
              </li>
              <li>
                <strong>{tr(i18n, "landing.mcpBullet3Title")}</strong> {tr(i18n, "landing.mcpBullet3Body")}
              </li>
              <li>
                <strong>{tr(i18n, "landing.mcpBullet4Title")}</strong> {tr(i18n, "landing.mcpBullet4Body1")}{" "}
                <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">npx 3m4-mcp</code>{" "}
                (<a href={MCP_NPM_URL} target="_blank" rel="noreferrer" class="text-primary-600 hover:underline">{tr(i18n, "landing.mcpBullet4Npm")}</a>)
                {" "}{tr(i18n, "landing.mcpBullet4Body2")}{" "}
                <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">https://3m4.net/mcp</code> {tr(i18n, "landing.mcpBullet4Body3")}
              </li>
            </ul>
          </div>
          <div class="panel-dark card min-w-0 bg-slate-900 p-6 text-slate-100">
            <div class="text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelLocal")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{MCP_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelRemote")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{MCP_REMOTE_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelJson")}</div>
            <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs leading-relaxed"><code>{`{
  "mcpServers": {
    "3m4": {
      "command": "npx",
      "args": ["-y", "3m4-mcp"],
      "env": { "M4_API_KEY": "m4_live_…" }
    }
  }
}`}</code></pre>
            <p class="mt-4 text-sm text-slate-300">
              {tr(i18n, "landing.mcpKeyNote")}{" "}
              <Link href="/dashboard/settings" class="text-white underline">
                {tr(i18n, "landing.mcpKeyLink")}
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Self-host callout */}
      <section class="mx-auto max-w-6xl px-4 pb-20">
        <div class="panel-dark card flex flex-col items-start gap-6 bg-slate-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-2xl font-bold">{tr(i18n, "landing.selfhostTitle")}</h2>
            <p class="mt-2 max-w-2xl text-slate-300">
              {tr(i18n, "landing.selfhostBody1")}
              <code class="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-sm">
                docker compose up
              </code>
              {tr(i18n, "landing.selfhostBody2")}
            </p>
          </div>
          <a
            href="https://github.com/Devace-93/3m4"
            target="_blank"
            rel="noreferrer"
            class="btn bg-white text-slate-900 hover:bg-slate-100"
          >
            {tr(i18n, "landing.viewGithub")}
          </a>
        </div>
      </section>
    </>
  );
});

export const head: DocumentHead = {
  title: "3m4 — Short links with real click analytics",
  meta: [
    {
      name: "description",
      content:
        "3m4 is an open-source URL shortener with click analytics: geo/device/referrer breakdowns, QR codes, custom domains, and a public API. Hosted or self-hostable (MIT).",
    },
  ],
};
