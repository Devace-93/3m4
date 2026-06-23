import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";

const features = [
  {
    title: "Short codes",
    body: "Random base62 codes on 3m4.net, with custom vanity slugs on paid plans.",
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
    body: "Create and manage links programmatically with scoped API keys.",
  },
];

export default component$(() => {
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
            <Link
              href="/info/pricing"
              class="btn-secondary px-6 py-3 text-base"
            >
              See pricing
            </Link>
          </div>
          <p class="mt-4 text-sm text-slate-500">
            Free plan: 50 links &amp; 1,000 tracked clicks / month. No card required.
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
            href="https://github.com/your-org/3m4"
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
