import { component$, useContext, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../lib/api";
import { setTokens, isAuthenticated } from "../../../lib/auth";
import { identify, capture } from "../../../lib/analytics";
import { FlagsContext } from "../../../lib/flags";

export default component$(() => {
  const nav = useNavigate();
  // Public flags are resolved by the root layout (server-side), so the
  // invite-only state renders without a client round-trip.
  const flags = useContext(FlagsContext);
  const state = useStore({
    email: "",
    password: "",
    accountName: "",
    loading: false,
    error: "",
  });

  // Already signed in? Skip straight to the dashboard.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (isAuthenticated()) nav("/dashboard");
  });

  const submit = $(async () => {
    state.error = "";
    state.loading = true;
    try {
      const res = await api.register(
        state.email,
        state.password,
        state.accountName || undefined,
      );
      setTokens(res.access_token, res.refresh_token);
      identify(res.user.id, res.account.id, res.account.plan);
      capture("signup", { plan: res.account.plan });
      await nav("/dashboard");
    } catch (e) {
      state.error =
        e instanceof ApiRequestError
          ? e.error.message
          : "Sign up failed. Please try again.";
    } finally {
      state.loading = false;
    }
  });

  if (!flags.signups) {
    return (
      <div class="card p-8 text-center">
        <h1 class="text-2xl font-bold text-slate-900">
          🔒 Sign-ups are invite-only right now
        </h1>
        <p class="mt-3 text-sm text-slate-500">
          We're rolling out gradually. Follow along — spots open soon.
        </p>
        <p class="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" class="font-medium text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div class="card p-8">
      <h1 class="text-2xl font-bold text-slate-900">Create your account</h1>
      <p class="mt-1 text-sm text-slate-500">
        {flags["early-access"]
          ? "Early access: full access, free. No card required."
          : "Free forever: 50 links & 1,000 tracked clicks / month."}
      </p>

      <form class="mt-6 space-y-4" preventdefault:submit onSubmit$={submit}>
        {state.error && (
          <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <div>
          <label class="label" for="accountName">
            Workspace name <span class="text-slate-400">(optional)</span>
          </label>
          <input
            id="accountName"
            type="text"
            class="input"
            placeholder="Acme Inc."
            value={state.accountName}
            onInput$={(_, el) => (state.accountName = el.value)}
          />
        </div>
        <div>
          <label class="label" for="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            class="input"
            value={state.email}
            onInput$={(_, el) => (state.email = el.value)}
          />
        </div>
        <div>
          <label class="label" for="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            class="input"
            value={state.password}
            onInput$={(_, el) => (state.password = el.value)}
          />
          <p class="mt-1 text-xs text-slate-400">At least 8 characters.</p>
        </div>
        <button type="submit" class="btn-primary w-full" disabled={state.loading}>
          {state.loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" class="font-medium text-primary-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
});

export const head: DocumentHead = { title: "Sign up — 3m4" };
