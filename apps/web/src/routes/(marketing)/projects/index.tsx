import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../lib/flags";

export default component$(() => {
  const flags = useContext(FlagsContext);
  if (!flags.projects) {
    return (
      <div class="mx-auto max-w-3xl px-4 py-20 text-center" data-testid="projects-hidden">
        <h1 class="text-3xl font-bold text-slate-900">Projects</h1>
        <p class="mt-3 text-slate-600">This section isn't public yet. Check back soon.</p>
        <Link href="/" class="btn-secondary mt-6">
          Back home
        </Link>
      </div>
    );
  }
  return (
    <div class="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold text-slate-900">Projects</h1>
      <p class="mt-3 text-slate-600">
        Things built with 3m4 and around it.
      </p>
      <div class="mt-8 card p-10 text-slate-500">Coming soon.</div>
    </div>
  );
});

export const head: DocumentHead = { title: "Projects — 3m4" };
