import {
  component$,
  useContext,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../lib/api";
import { profileUrl } from "../../../../lib/auth";
import { FlagsContext } from "../../../../lib/flags";
import { tr, useI18n } from "../../../../i18n";
import type { ApiKey, ApiKeyRole } from "../../../../lib/types";
import roleRegistry from "../../../../../../../packages/shared/api_key_roles.json";

const ROLES = roleRegistry.roles as Record<
  ApiKeyRole,
  { label: string; description: string; scopes: string[] }
>;
const DEFAULT_ROLE = roleRegistry.default_role as ApiKeyRole;

export default component$(() => {
  const nav = useNavigate();
  const flags = useContext(FlagsContext);
  const i18n = useI18n();
  const state = useStore<{
    keys: ApiKey[];
    loading: boolean;
    error: string;
    newName: string;
    newRole: ApiKeyRole;
    creating: boolean;
    createdSecret: string; // shown once
    copied: boolean;
  }>({
    keys: [],
    loading: true,
    error: "",
    newName: "",
    newRole: DEFAULT_ROLE,
    creating: false,
    createdSecret: "",
    copied: false,
  });

  // Resolved during render so handlers capture strings, not the i18n store.
  const msgLoadFailed = tr(i18n, "keys.loadFailed");
  const msgCreateFailed = tr(i18n, "keys.createFailed");
  const msgRevokeFailed = tr(i18n, "keys.revokeFailed");

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
      state.error = e instanceof ApiRequestError ? e.error.message : msgLoadFailed;
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
      const res = await api.createApiKey(state.newName.trim(), state.newRole);
      state.createdSecret = res.key;
      state.newName = "";
      state.newRole = DEFAULT_ROLE;
      load();
    } catch (e) {
      state.error = e instanceof ApiRequestError ? e.error.message : msgCreateFailed;
    } finally {
      state.creating = false;
    }
  });

  const revoke = $(async (id: string) => {
    try {
      await api.deleteApiKey(id);
      state.keys = state.keys.filter((k) => k.id !== id);
    } catch (e) {
      state.error = e instanceof ApiRequestError ? e.error.message : msgRevokeFailed;
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
        <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "keys.title")}</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            {tr(i18n, "keys.unavailableTitle")}
          </p>
          <p class="mt-2 text-sm">
            {tr(i18n, "keys.unavailableBody")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "keys.title")}</h1>
      <p class="mt-1 text-sm text-slate-500">
        {tr(i18n, "keys.usage")}{" "}
        <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          X-API-Key: m4_live_…
        </code>
      </p>
      {/* Identity (e-mail, password, avatar, linked logins) is managed at accounts. */}
      <p class="mt-2 text-sm text-slate-500">
        <a href={profileUrl()} class="font-medium text-primary-600 hover:underline" data-testid="profile-link">
          {tr(i18n, "nav.profile")} →
        </a>
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
            {tr(i18n, "keys.copyNow")}
          </p>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-sm text-slate-800">
              {state.createdSecret}
            </code>
            <button type="button" class="btn-secondary" onClick$={copySecret}>
              {state.copied ? tr(i18n, "common.copied") : tr(i18n, "common.copy")}
            </button>
          </div>
          <button
            type="button"
            class="btn-ghost mt-2 text-xs"
            onClick$={() => (state.createdSecret = "")}
          >
            {tr(i18n, "keys.dismiss")}
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
            {tr(i18n, "keys.newKeyName")}
          </label>
          <input
            id="keyname"
            type="text"
            placeholder={tr(i18n, "keys.namePlaceholder")}
            class="input"
            value={state.newName}
            onInput$={(_, el) => (state.newName = el.value)}
          />
        </div>
        <div>
          <label class="label" for="keyrole">
            {tr(i18n, "common.role")}
          </label>
          <select
            id="keyrole"
            class="input"
            value={state.newRole}
            onChange$={(_, el) => (state.newRole = el.value as ApiKeyRole)}
          >
            {(Object.keys(ROLES) as ApiKeyRole[]).map((r) => (
              <option key={r} value={r} selected={r === state.newRole}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" class="btn-primary" disabled={state.creating}>
          {state.creating ? tr(i18n, "common.creating") : tr(i18n, "keys.createKey")}
        </button>
      </form>
      <p class="mt-2 text-xs text-slate-500">
        {ROLES[state.newRole].description}{" "}
        <span class="font-mono">({ROLES[state.newRole].scopes.join(", ")})</span>
      </p>

      {/* List */}
      <div class="mt-6 card overflow-hidden">
        {state.loading ? (
          <div class="p-8 text-center text-sm text-slate-400">
            {tr(i18n, "common.loading")}
          </div>
        ) : state.keys.length === 0 ? (
          <div class="p-8 text-center text-sm text-slate-500">
            {tr(i18n, "keys.empty")}
          </div>
        ) : (
          <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">{tr(i18n, "common.name")}</th>
                <th class="px-4 py-3">{tr(i18n, "keys.colPrefix")}</th>
                <th class="px-4 py-3">{tr(i18n, "common.role")}</th>
                <th class="px-4 py-3">{tr(i18n, "keys.colLastUsed")}</th>
                <th class="px-4 py-3">{tr(i18n, "common.created")}</th>
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
                  <td class="px-4 py-3">
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {ROLES[k.role]?.label ?? k.role}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-slate-500">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleDateString()
                      : tr(i18n, "keys.never")}
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
                      {tr(i18n, "keys.revoke")}
                    </button>
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

export const head: DocumentHead = { title: "API keys — 3m4" };
