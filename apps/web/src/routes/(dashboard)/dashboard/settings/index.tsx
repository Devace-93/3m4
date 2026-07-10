import {
  component$,
  useContext,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../lib/api";
import { FlagsContext } from "../../../../lib/flags";
import type { ApiKey } from "../../../../lib/types";

export default component$(() => {
  const nav = useNavigate();
  const flags = useContext(FlagsContext);
  const state = useStore<{
    keys: ApiKey[];
    loading: boolean;
    error: string;
    newName: string;
    creating: boolean;
    createdSecret: string; // shown once
    copied: boolean;
  }>({
    keys: [],
    loading: true,
    error: "",
    newName: "",
    creating: false,
    createdSecret: "",
    copied: false,
  });

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      state.keys = await api.listApiKeys();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error =
        e instanceof ApiRequestError ? e.error.message : "Failed to load API keys.";
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
  });

  const create = $(async () => {
    if (!state.newName.trim()) return;
    state.creating = true;
    state.error = "";
    try {
      const res = await api.createApiKey(state.newName.trim());
      state.createdSecret = res.key;
      state.newName = "";
      load();
    } catch (e) {
      state.error =
        e instanceof ApiRequestError ? e.error.message : "Could not create key.";
    } finally {
      state.creating = false;
    }
  });

  const revoke = $(async (id: string) => {
    try {
      await api.deleteApiKey(id);
      state.keys = state.keys.filter((k) => k.id !== id);
    } catch (e) {
      state.error =
        e instanceof ApiRequestError ? e.error.message : "Could not revoke key.";
    }
  });

  const copySecret = $(async () => {
    try {
      await navigator.clipboard.writeText(state.createdSecret);
      state.copied = true;
      setTimeout(() => (state.copied = false), 1500);
    } catch {
      /* ignore */
    }
  });

  if (!flags["public-api"]) {
    return (
      <div class="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">API keys</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            The public API isn't available yet.
          </p>
          <p class="mt-2 text-sm">
            We're rolling it out gradually — check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="text-2xl font-bold text-slate-900">API keys</h1>
      <p class="mt-1 text-sm text-slate-500">
        Use keys with the public API:{" "}
        <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          X-API-Key: m4_live_…
        </code>
      </p>

      {state.error && (
        <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Secret shown once after creation */}
      {state.createdSecret && (
        <div class="mt-4 rounded-lg border border-green-300 bg-green-50 p-4">
          <p class="text-sm font-semibold text-green-800">
            Copy your new key now — it won't be shown again.
          </p>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-sm text-slate-800">
              {state.createdSecret}
            </code>
            <button type="button" class="btn-secondary" onClick$={copySecret}>
              {state.copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            class="btn-ghost mt-2 text-xs"
            onClick$={() => (state.createdSecret = "")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <form
        class="mt-6 flex items-end gap-3"
        preventdefault:submit
        onSubmit$={create}
      >
        <div class="flex-1">
          <label class="label" for="keyname">
            New key name
          </label>
          <input
            id="keyname"
            type="text"
            placeholder="CI pipeline"
            class="input"
            value={state.newName}
            onInput$={(_, el) => (state.newName = el.value)}
          />
        </div>
        <button type="submit" class="btn-primary" disabled={state.creating}>
          {state.creating ? "Creating…" : "Create key"}
        </button>
      </form>

      {/* List */}
      <div class="mt-6 card overflow-hidden">
        {state.loading ? (
          <div class="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : state.keys.length === 0 ? (
          <div class="p-8 text-center text-sm text-slate-500">No API keys yet.</div>
        ) : (
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3">Prefix</th>
                <th class="px-4 py-3">Last used</th>
                <th class="px-4 py-3">Created</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {state.keys.map((k) => (
                <tr key={k.id}>
                  <td class="px-4 py-3 font-medium text-slate-800">
                    {k.name || "—"}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-slate-600">
                    {k.prefix}…
                  </td>
                  <td class="px-4 py-3 text-slate-500">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td class="px-4 py-3 text-slate-500">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="text-xs font-medium text-red-600 hover:underline"
                      onClick$={() => revoke(k.id)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = { title: "API keys — 3m4" };
