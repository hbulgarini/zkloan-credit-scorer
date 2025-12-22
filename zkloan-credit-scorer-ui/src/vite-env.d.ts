/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID: string;
  readonly VITE_LOGGING_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
