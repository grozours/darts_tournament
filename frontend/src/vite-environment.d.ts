/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_AUTH0?: string;
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_AUTH0_CONNECTION_GOOGLE?: string;
  readonly VITE_AUTH0_CONNECTION_FACEBOOK?: string;
  readonly VITE_AUTH0_CONNECTION_INSTAGRAM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
