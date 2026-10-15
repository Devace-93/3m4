import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FlagsContext } from "../../../lib/flags";
import { tr, useI18n } from "../../../i18n";

export default component$(() => {
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
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
  return (
    <div class="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold text-slate-900">{tr(i18n, "projects.title")}</h1>
      <p class="mt-3 text-slate-600">
        {tr(i18n, "projects.intro")}
      </p>
      <div class="mt-8 card p-10 text-slate-500">{tr(i18n, "projects.comingSoon")}</div>
    </div>
  );
});

export const head: DocumentHead = { title: "Projects — 3m4" };
