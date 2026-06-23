import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

const GITHUB_URL = "https://github.com/your-org/3m4"; // TODO: real repo URL

export const Footer = component$(() => {
  const year = new Date().getFullYear();
  return (
    <footer class="border-t border-slate-200 bg-slate-50">
      <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="font-semibold text-slate-700">3m4</span>
          <Link href="/info/pricing" class="hover:text-primary-600">
            Pricing
          </Link>
          <Link href="/blog" class="hover:text-primary-600">
            Blog
          </Link>
          <Link href="/projects" class="hover:text-primary-600">
            Projects
          </Link>
          <Link href="/sponsors" class="hover:text-primary-600">
            Sponsors
          </Link>
        </div>
        <div class="flex items-center gap-4">
          <span>Open source · MIT</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            class="hover:text-primary-600"
          >
            GitHub
          </a>
          <span class="text-slate-400">© {year} Enrique Magallon Alvarez</span>
        </div>
      </div>
    </footer>
  );
});
