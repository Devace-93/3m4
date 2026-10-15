import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../lib/flags";

const features = [
  {
    title: "Short codes",
    body: "Random base62 codes on 3m4.net, or custom vanity slugs like 3m4.net/launch.",
  },
  {
    title: "Custom domains",
    body: "Bring your own domain with automatic TLS so links stay on-brand.",
  },
  {
    title: "301 / 302 redirects",
    body: "302 by default for accurate analytics; flip any link to a permanent 301.",
  },
  {
    title: "Click analytics",
    body: "Time-series, plus breakdowns by country, device, and referrer — no raw IPs stored.",
  },
  {
    title: "QR codes",
    body: "Every link ships with a downloadable QR code, generated on demand.",
  },
  {
    title: "Public API",
    body: "Create and manage links programmatically with role-scoped API keys.",
  },
  {
    title: "MCP server for AI agents",
    body: "Claude Code, Cursor or any MCP host can shorten links and read analytics for you, with roles, confirmations and an audit log.",
  },
];

const MCP_SNIPPET = "claude mcp add 3m4 --scope user --env M4_API_KEY=m4_live_… -- npx -y 3m4-mcp";

export default component$(() => {
  const flags = useContext(FlagsContext);
  const early = flags["early-access"];
  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-primary-50 to-white">
        <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <span class="badge mb-5 bg-primary-100 text-primary-700">
            Open source · MIT · Self-hostable
          </span>
          <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Short links with{" "}
            <span class="text-primary-600">real click analytics</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            3m4 turns long URLs into tidy short links and shows you exactly who
            clicks — geo, device, and referrer breakdowns, QR codes, and a public
            API. Hosted by us, or self-host the whole thing.
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" class="btn-primary px-6 py-3 text-base">
              Get started free
            </Link>
            {early ? (
              <Link
                href="/blog/what-paid-plans-will-include"
                class="btn-secondary px-6 py-3 text-base"
              >
                Why it's free right now
              </Link>
            ) : (
              <Link
                href="/info/pricing"
                class="btn-secondary px-6 py-3 text-base"
              >
                See pricing
              </Link>
            )}
          </div>
          <p class="mt-4 text-sm text-slate-500" data-testid="hero-plan-note">
            {early
              ? "Early access: every account gets full access, free. Plans come later, with notice."
              : "Free plan: 50 links & 1,000 tracked clicks / month. No card required."}
          </p>
        </div>
      </section>

      {/* Features */}
      <section class="mx-auto max-w-6xl px-4 py-16">
        <h2 class="text-center text-3xl font-bold text-slate-900">
          Everything you need to share &amp; measure links
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
            <span class="badge bg-primary-100 text-primary-700">New · Model Context Protocol</span>
            <h2 class="mt-4 text-3xl font-bold text-slate-900">
              Let your AI agent manage links
            </h2>
            <p class="mt-3 text-slate-600">
              3m4 ships an MCP server. Connect it to Claude Code, Claude Desktop,
              Cursor or any MCP host and ask things like{" "}
              <em>“shorten this URL and give me the QR”</em> or{" "}
              <em>“which of my links got the most clicks this month?”</em>
            </p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li>
                <strong>Role-scoped keys.</strong> A viewer key never even sees the
                delete tool; editor and admin unlock more. Enforced by the API too.
              </li>
              <li>
                <strong>Human in the loop.</strong> Destructive actions ask you to
                confirm before anything happens.
              </li>
              <li>
                <strong>Audit trail.</strong> Every change and every refused call is
                logged, server-side and agent-side.
              </li>
              <li>
                <strong>Local or remote.</strong> Run it over stdio with{" "}
                <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">npx 3m4-mcp</code>{" "}
                or point your host at <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">/mcp</code> with your key.
              </li>
            </ul>
          </div>
          <div class="card min-w-0 bg-slate-900 p-6 text-slate-100">
            <div class="text-xs uppercase tracking-wide text-slate-400">Claude Code</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{MCP_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">Any MCP host (JSON)</div>
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
              Create a key with the role you want under{" "}
              <Link href="/dashboard/settings" class="text-white underline">
                Dashboard → API keys
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Self-host callout */}
      <section class="mx-auto max-w-6xl px-4 pb-20">
        <div class="card flex flex-col items-start gap-6 bg-slate-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-2xl font-bold">Self-host it (MIT, open source)</h2>
            <p class="mt-2 max-w-2xl text-slate-300">
              The entire stack — Flask API, redirect service, worker, and this
              Qwik app — is MIT-licensed. Run it on your own VPS with one
              <code class="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-sm">
                docker compose up
              </code>
              . No billing code, no limits beyond what you configure.
            </p>
          </div>
          <a
            href="https://github.com/Devace-93/3m4"
            target="_blank"
            rel="noreferrer"
            class="btn bg-white text-slate-900 hover:bg-slate-100"
          >
            View on GitHub
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
