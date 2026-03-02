/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_AUTH0?: string;
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_AUTH0_CONNECTION_GOOGLE?: string;
  readonly VITE_AUTH0_CONNECTION_FACEBOOK?: string;
  readonly VITE_AUTH0_CONNECTION_DISCORD?: string;
  readonly VITE_AUTH0_CONNECTION_INSTAGRAM?: string;
  readonly VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS?: string;
  readonly VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS?: string;
  readonly VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS?: string;
  readonly VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
