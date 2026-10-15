import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../lib/flags";

// Supporters are added here (with their permission) as Pro/Team subscriptions
// come in. Empty until launch brings the first ones.
const sponsors: { name: string; tier: string; url: string }[] = [];

export default component$(() => {
  const flags = useContext(FlagsContext);
  const early = flags["early-access"];
  return (
    <div class="mx-auto max-w-4xl px-4 py-16">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-slate-900">Sponsors</h1>
        <p class="mx-auto mt-3 max-w-2xl text-slate-600">
          3m4 is open source (MIT). Every{" "}
          <Link href="/info/pricing" class="text-primary-600 hover:underline">
            Pro / Supporter
          </Link>{" "}
          subscriber {early ? "will help" : "helps"} keep it free to self-host
          — and {early ? "will get" : "gets"} a badge and a spot on this page.
        </p>
      </div>

      {sponsors.length === 0 && (
        <div class="mt-12 card p-10 text-center">
          <p class="font-semibold text-slate-900">
            Your name could be the first on this page.
          </p>
          <p class="mt-1 text-sm text-slate-500">
            {early
              ? "Supporter subscriptions open together with paid plans, after early access. Until then every account is free."
              : "Every Pro / Supporter subscriber gets a spot here and an embeddable badge."}
          </p>
        </div>
      )}

      {sponsors.length > 0 && (
      <div class="mt-12 grid gap-4 sm:grid-cols-2">
        {sponsors.map((s) => (
          <a
            key={s.name}
            href={s.url}
            class="card flex items-center justify-between p-5 hover:border-primary-300"
          >
            <div class="flex items-center gap-3">
              <span class="grid h-10 w-10 place-items-center rounded-full bg-primary-100 font-bold text-primary-700">
                {s.name.charAt(0)}
              </span>
              <span class="font-semibold text-slate-900">{s.name}</span>
            </div>
            <span
              class={[
                "badge",
                s.tier === "Team"
                  ? "bg-primary-600 text-white"
                  : "bg-primary-100 text-primary-700",
              ]}
            >
              {s.tier} supporter
            </span>
          </a>
        ))}
      </div>
      )}

      {/* Badge concept */}
      <div class="mt-12 card p-6">
        <h2 class="font-semibold text-slate-900">The supporter badge</h2>
        <p class="mt-1 text-sm text-slate-600">
          Pro supporters {early ? "will get" : "get"} an embeddable badge for
          their site or README:
        </p>
        <div class="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700">
          <span class="grid h-5 w-5 place-items-center rounded bg-primary-600 text-[10px] font-extrabold text-white">
            3m
          </span>
          3m4 Supporter
        </div>
      </div>

      <div class="mt-10 text-center">
        {early ? (
          <Link href="/blog/what-paid-plans-will-include" class="btn-primary">
            Read about the upcoming plans
          </Link>
        ) : (
          <Link href="/signup" class="btn-primary">
            Become a supporter
          </Link>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sponsors — 3m4",
  meta: [
    {
      name: "description",
      content:
        "Supporters of 3m4, the open-source URL shortener. Pro/Supporter subscribers appear here with a badge.",
    },
  ],
};
