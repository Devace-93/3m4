import { component$, useContext } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../../lib/flags";
import { tr, useI18n } from "../../../../i18n";

export default component$(() => {
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
  const loc = useLocation();
  if (!flags.projects) {
    return (
      <div class="mx-auto max-w-3xl px-4 py-20 text-center" data-testid="projects-hidden">
        <h1 class="text-3xl font-bold text-slate-900">{tr(i18n, "projects.title")}</h1>
        <p class="mt-3 text-slate-600">{tr(i18n, "projects.hidden")}</p>
        <Link href="/" class="btn-secondary mt-6">
          {tr(i18n, "projects.backHome")}
        </Link>
      </div>
    );
  }
  const slug = (loc.params.slug || "").split("/")[0].replace(/-/g, " ");
  return (
    <div class="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold capitalize text-slate-900">
        {slug || tr(i18n, "projects.fallbackTitle")}
      </h1>
      <p class="mt-3 text-slate-600">{tr(i18n, "projects.comingSoon")}</p>
      <Link href="/projects" class="btn-secondary mt-6">
        {tr(i18n, "projects.backToProjects")}
      </Link>
    </div>
  );
});

export const head: DocumentHead = ({ params }) => ({
  title: `${(params.slug || "Project").split("/")[0].replace(/-/g, " ")} — 3m4 Projects`,
});
