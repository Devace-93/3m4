import { component$ } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";

/** Placeholder post layout — static for now. */
export default component$(() => {
  const loc = useLocation();
  const slug = (loc.params.slug || "").split("/")[0].replace(/-/g, " ");
  return (
    <article class="mx-auto max-w-2xl px-4 py-20">
      <h1 class="text-3xl font-bold capitalize text-slate-900">
        {slug || "Post"}
      </h1>
      <p class="mt-2 text-sm text-slate-500">Draft · coming soon</p>
      <div class="prose mt-8 text-slate-600">
        <p>This post hasn't been published yet. Check back soon.</p>
      </div>
      <Link href="/blog" class="btn-secondary mt-8">
        Back to Blog
      </Link>
    </article>
  );
});

export const head: DocumentHead = ({ params }) => ({
  title: `${(params.slug || "Post").split("/")[0].replace(/-/g, " ")} — 3m4 Blog`,
});
