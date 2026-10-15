import { component$, useContext } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { FlagsContext } from "../lib/flags";

/**
 * Shown wherever plans or limits would otherwise appear while the
 * `early-access` flag is ON. Renders nothing when the flag is OFF.
 */
export const EarlyAccessBanner = component$<{ compact?: boolean }>(({ compact }) => {
  const flags = useContext(FlagsContext);
  if (!flags["early-access"]) return null;
  return (
    <div
      class={[
        "rounded-lg border border-primary-200 bg-primary-50 text-primary-900",
        compact ? "px-3 py-2 text-sm" : "px-4 py-3",
      ]}
      role="status"
    >
      <span class="font-semibold">Early access.</span>{" "}
      Every account has full access at no cost right now. Plans and limits will
      be introduced later, with notice before anything changes.{" "}
      <Link href="/blog/what-paid-plans-will-include" class="font-medium underline">
        What paid plans will include
      </Link>
    </div>
  );
});
