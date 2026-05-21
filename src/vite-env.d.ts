/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CREATOR_BYPASS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
