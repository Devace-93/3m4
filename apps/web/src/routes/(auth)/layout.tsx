import { component$, Slot } from "@builder.io/qwik";
import { Logo } from "../../components/logo";

/** Minimal centered layout for /login and /signup. */
export default component$(() => {
  return (
    <div class="flex min-h-screen flex-col bg-slate-50">
      <header class="mx-auto w-full max-w-6xl px-4 py-5">
        <Logo />
      </header>
      <main class="flex flex-1 items-center justify-center px-4 py-10">
        <div class="w-full max-w-md">
          <Slot />
        </div>
      </main>
    </div>
  );
});
