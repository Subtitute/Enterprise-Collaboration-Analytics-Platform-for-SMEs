/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_NOTIFICATION_URL: string;
  readonly VITE_WS_ANALYTICS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
