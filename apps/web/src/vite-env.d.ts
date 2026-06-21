/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIPLOMAT_WORKER_BASE_URL?: string;
  readonly VITE_DIPLOMAT_UI_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
