/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SHORT_DOMAIN?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_REVENUECAT_PUBLIC_KEY?: string;
  readonly VITE_BILLING_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
