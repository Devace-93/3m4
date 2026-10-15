/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SHORT_DOMAIN?: string;
  /** Apps index (info.3m4.net); footer link shared by every 3m4 app. */
  readonly VITE_INFO_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_REVENUECAT_PUBLIC_KEY?: string;
  readonly VITE_BILLING_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
