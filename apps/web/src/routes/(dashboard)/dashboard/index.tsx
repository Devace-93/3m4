import {
  component$,
  useContext,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { Link, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../lib/api";
import { capture } from "../../../lib/analytics";
import { UsageBar } from "../../../components/usage-bar";
import { EarlyAccessBanner } from "../../../components/early-access-banner";
import { FlagsContext } from "../../../lib/flags";
import type { Link as LinkObj, MeResponse } from "../../../lib/types";

export default component$(() => {
  const nav = useNavigate();
  const flags = useContext(FlagsContext);
  const state = useStore<{
    links: LinkObj[];
    me: MeResponse | null;
    loading: boolean;
    loadError: string;
  }>({ links: [], me: null, loading: true, loadError: "" });

  const form = useStore({
    destination_url: "",
    custom_slug: "",
    title: "",
    redirect_type: 302 as 301 | 302,
    submitting: false,
    error: "",
    limitReached: false,
  });

  const copied = useStore<{ id: string }>({ id: "" });

  const load = $(async () => {
    state.loading = true;
    state.loadError = "";
    try {
      const [me, links] = await Promise.all([api.me(), api.listLinks(1, 50)]);
      state.me = me;
      state.links = links.items;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.loadError =
        e instanceof ApiRequestError ? e.error.message : "Failed to load dashboard.";
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
  });

  const createLink = $(async () => {
    form.error = "";
    form.limitReached = false;
    form.submitting = true;
    try {
      const link = await api.createLink({
        destination_url: form.destination_url,
        custom_slug: form.custom_slug || undefined,
        title: form.title || undefined,
        redirect_type: form.redirect_type,
      });
      capture("link_created", { redirect_type: form.redirect_type });
      state.links = [link, ...state.links];
      form.destination_url = "";
      form.custom_slug = "";
      form.title = "";
      // Refresh usage counters.
      api.me().then((me) => (state.me = me)).catch(() => {});
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 402) {
        form.limitReached = true;
        form.error =
          e.error.message || "You've hit your monthly link limit on this plan.";
      } else {
        form.error =
          e instanceof ApiRequestError ? e.error.message : "Could not create link.";
      }
    } finally {
      form.submitting = false;
    }
  });

  const copy = $(async (link: LinkObj) => {
    try {
      await navigator.clipboard.writeText(link.short_url);
      copied.id = link.id;
      setTimeout(() => (copied.id = ""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  });

  const limits = state.me?.limits;
  const usage = state.me?.usage;

  return (
    <div class="mx-auto max-w-6xl px-4 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Your links</h1>
          {state.me && (
            <p class="text-sm text-slate-500">
              {state.me.account.name} ·{" "}
              {flags["early-access"] ? (
                <span>Early access</span>
              ) : (
                <>
                  <span class="capitalize">{state.me.account.plan}</span> plan
                </>
              )}
            </p>
          )}
        </div>
        {flags.billing && !flags["early-access"] && (
          <Link href="/dashboard/billing" class="btn-secondary">
            Upgrade plan
          </Link>
        )}
      </div>

      <div class="mt-4">
        <EarlyAccessBanner />
      </div>

      {/* Usage */}
      {limits && usage && (
        <div class="mt-6 grid gap-6 sm:grid-cols-2">
          <div class="card p-5">
            <UsageBar
              label="Links this period"
              used={usage.links_created}
              limit={limits.links_per_month}
            />
          </div>
          <div class="card p-5">
            <UsageBar
              label="Tracked clicks this period"
              used={usage.tracked_clicks}
              limit={limits.tracked_clicks_per_month}
            />
          </div>
        </div>
      )}

      {/* Create form (feature-flagged: link-creation) */}
      {!flags["link-creation"] ? (
        <div class="mt-6 card p-6 text-center">
          <h2 class="text-lg font-semibold text-slate-800">
            Link creation is temporarily unavailable
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Your existing short links keep working and redirecting as usual.
          </p>
        </div>
      ) : (
      <div class="mt-6 card p-6">
        <h2 class="text-lg font-semibold text-slate-900">Create link</h2>
        {form.error && (
          <div
            class={[
              "mt-4 rounded-lg border px-3 py-2 text-sm",
              form.limitReached
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700",
            ]}
          >
            {form.error}{" "}
            {form.limitReached && !flags["early-access"] && (
              <Link href="/dashboard/billing" class="font-semibold underline">
                Upgrade your plan
              </Link>
            )}
          </div>
        )}
        <form
          class="mt-4 grid gap-4 sm:grid-cols-2"
          preventdefault:submit
          onSubmit$={createLink}
        >
          <div class="sm:col-span-2">
            <label class="label" for="dest">
              Destination URL
            </label>
            <input
              id="dest"
              type="url"
              required
              placeholder="https://example.com/very/long/url"
              class="input"
              value={form.destination_url}
              onInput$={(_, el) => (form.destination_url = el.value)}
            />
          </div>
          {flags["custom-slugs"] && (
            <div>
              <label class="label" for="slug">
                Custom slug{" "}
                <span class="text-slate-400">
                  {flags["early-access"] ? "(optional)" : "(optional, paid)"}
                </span>
              </label>
              <input
                id="slug"
                type="text"
                placeholder="my-link"
                class="input"
                disabled={state.me ? !state.me.limits.custom_slugs : false}
                value={form.custom_slug}
                onInput$={(_, el) => (form.custom_slug = el.value)}
              />
              {state.me && !state.me.limits.custom_slugs && (
                <p class="mt-1 text-xs text-slate-400">
                  Available on paid plans.
                  {flags.billing && (
                    <>
                      {" "}
                      <Link
                        href="/dashboard/billing"
                        class="font-medium text-primary-600 hover:underline"
                      >
                        Upgrade
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          <div>
            <label class="label" for="title">
              Title <span class="text-slate-400">(optional)</span>
            </label>
            <input
              id="title"
              type="text"
              class="input"
              value={form.title}
              onInput$={(_, el) => (form.title = el.value)}
            />
          </div>
          <div>
            <label class="label" for="rtype">
              Redirect type
            </label>
            <select
              id="rtype"
              class="input"
              value={String(form.redirect_type)}
              onChange$={(_, el) =>
                (form.redirect_type = Number(el.value) as 301 | 302)
              }
            >
              <option value="302">302 — Temporary (tracks every click)</option>
              <option value="301">301 — Permanent (cached by browsers)</option>
            </select>
          </div>
          <div class="flex items-end">
            <button
              type="submit"
              class="btn-primary w-full sm:w-auto"
              disabled={form.submitting}
            >
              {form.submitting ? "Creating…" : "Create link"}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Links table */}
      <div class="mt-6 card overflow-hidden">
        {state.loading ? (
          <div class="p-10 text-center text-sm text-slate-400">Loading links…</div>
        ) : state.loadError ? (
          <div class="p-10 text-center text-sm text-red-600">{state.loadError}</div>
        ) : state.links.length === 0 ? (
          <div class="p-10 text-center text-sm text-slate-500">
            No links yet. Create your first one above.
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">Short URL</th>
                  <th class="px-4 py-3">Destination</th>
                  <th class="px-4 py-3 text-right">Clicks</th>
                  <th class="px-4 py-3">Created</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {state.links.map((l) => (
                  <tr key={l.id} class="hover:bg-slate-50">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <Link
                          href={`/dashboard/links/${l.id}`}
                          class="font-medium text-primary-600 hover:underline"
                        >
                          {l.short_url.replace(/^https?:\/\//, "")}
                        </Link>
                        <button
                          type="button"
                          class="text-xs text-slate-400 hover:text-primary-600"
                          onClick$={() => copy(l)}
                          title="Copy short URL"
                        >
                          {copied.id === l.id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      {l.title && (
                        <div class="text-xs text-slate-400">{l.title}</div>
                      )}
                    </td>
                    <td class="max-w-xs truncate px-4 py-3 text-slate-600">
                      <a
                        href={l.destination_url}
                        target="_blank"
                        rel="noreferrer"
                        class="hover:text-primary-600"
                      >
                        {l.destination_url}
                      </a>
                    </td>
                    <td class="px-4 py-3 text-right font-semibold text-slate-900">
                      {l.click_count.toLocaleString()}
                    </td>
                    <td class="px-4 py-3 text-slate-500">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-4 py-3 text-right">
                      {flags["analytics-dashboard"] && (
                        <Link
                          href={`/dashboard/links/${l.id}`}
                          class="text-xs font-medium text-slate-500 hover:text-primary-600"
                        >
                          Analytics →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = { title: "Dashboard — 3m4" };
