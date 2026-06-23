import { component$, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../lib/api";
import { setTokens, isAuthenticated } from "../../../lib/auth";
import { identify } from "../../../lib/analytics";

export default component$(() => {
  const nav = useNavigate();
  const state = useStore({
    email: "",
    password: "",
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
      const res = await api.login(state.email, state.password);
      setTokens(res.access_token, res.refresh_token);
      identify(res.user.id, res.account.id, res.account.plan);
      await nav("/dashboard");
    } catch (e) {
      state.error =
        e instanceof ApiRequestError
          ? e.error.message
          : "Login failed. Check your email and password.";
    } finally {
      state.loading = false;
    }
  });

  return (
    <div class="card p-8">
      <h1 class="text-2xl font-bold text-slate-900">Log in</h1>
      <p class="mt-1 text-sm text-slate-500">Welcome back to 3m4.</p>

      <form
        class="mt-6 space-y-4"
        preventdefault:submit
        onSubmit$={submit}
      >
        {state.error && (
          <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
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
            autoComplete="current-password"
            class="input"
            value={state.password}
            onInput$={(_, el) => (state.password = el.value)}
          />
        </div>
        <button type="submit" class="btn-primary w-full" disabled={state.loading}>
          {state.loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link href="/signup" class="font-medium text-primary-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
});

export const head: DocumentHead = { title: "Log in — 3m4" };
