import { component$ } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { findPost, fmtDate } from "../../../../content/posts";

export default component$(() => {
  const loc = useLocation();
  const slug = (loc.params.slug || "").split("/")[0];
  const post = findPost(slug);

  if (!post) {
    return (
      <article class="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 class="text-3xl font-bold text-slate-900">Post not found</h1>
        <p class="mt-3 text-slate-600">
          There is no post at <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">/blog/{slug}</code>.
        </p>
        <Link href="/blog" class="btn-secondary mt-8">
          Back to Blog
        </Link>
      </article>
    );
  }

  return (
    <article class="mx-auto max-w-2xl px-4 py-16">
      <Link href="/blog" class="text-sm text-slate-500 hover:text-primary-600">
        ← All posts
      </Link>
      <time dateTime={post.date} class="mt-6 block text-xs uppercase tracking-wide text-slate-400">
        {fmtDate(post.date)}
      </time>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900">{post.title}</h1>
      <p class="mt-4 text-lg text-slate-600">{post.summary}</p>
      <div class="mt-8 space-y-8 text-slate-700">
        {post.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 class="text-xl font-semibold text-slate-900">{s.heading}</h2>}
            {s.paragraphs?.map((p, j) => (
              <p key={j} class="mt-3 leading-relaxed">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul class="mt-3 list-disc space-y-2 pl-6">
                {s.bullets.map((b, j) => (
                  <li key={j} class="leading-relaxed">
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div class="mt-10 flex flex-wrap gap-3">
        <Link href="/info/pricing" class="btn-secondary">
          See the planned tiers
        </Link>
        <Link href="/signup" class="btn-primary">
          Get started free
        </Link>
      </div>
    </article>
  );
});

export const head: DocumentHead = ({ params }) => {
  const post = findPost((params.slug || "").split("/")[0]);
  return {
    title: post ? `${post.title} — 3m4 Blog` : "Post not found — 3m4 Blog",
    meta: post ? [{ name: "description", content: post.summary }] : [],
  };
};
