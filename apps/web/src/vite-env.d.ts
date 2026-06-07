/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIPLOMAT_WORKER_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
