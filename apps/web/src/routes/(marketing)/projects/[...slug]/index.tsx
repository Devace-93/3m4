import { component$, useContext } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../../lib/flags";

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
  const loc = useLocation();
  const slug = (loc.params.slug || "").split("/")[0].replace(/-/g, " ");
  return (
    <div class="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold capitalize text-slate-900">
        {slug || "Project"}
      </h1>
      <p class="mt-3 text-slate-600">Coming soon.</p>
      <Link href="/projects" class="btn-secondary mt-6">
        Back to Projects
      </Link>
    </div>
  );
});

export const head: DocumentHead = ({ params }) => ({
  title: `${(params.slug || "Project").split("/")[0].replace(/-/g, " ")} — 3m4 Projects`,
});
