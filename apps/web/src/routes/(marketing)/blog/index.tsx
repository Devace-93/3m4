import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { POSTS, fmtDate } from "../../../content/posts";

export default component$(() => {
  return (
    <div class="mx-auto max-w-3xl px-4 py-16">
      <h1 class="text-3xl font-bold text-slate-900">Blog</h1>
      <p class="mt-3 text-slate-600">
        Product updates, engineering notes, and link-building tips.
      </p>
      {POSTS.length === 0 ? (
        <div class="mt-8 card p-10 text-center text-slate-500">Coming soon.</div>
      ) : (
        <ul class="mt-8 space-y-4">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} class="card block p-6 hover:border-primary-300">
                <time dateTime={p.date} class="text-xs uppercase tracking-wide text-slate-400">
                  {fmtDate(p.date)}
                </time>
                <h2 class="mt-1 text-xl font-semibold text-slate-900">{p.title}</h2>
                <p class="mt-2 text-sm text-slate-600">{p.summary}</p>
                <span class="mt-3 inline-block text-sm font-medium text-primary-600">
                  Read more →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export const head: DocumentHead = { title: "Blog — 3m4" };
