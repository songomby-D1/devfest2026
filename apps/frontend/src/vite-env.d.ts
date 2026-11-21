/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` serves the contract fixtures in the browser. Anything else calls the gateway. */
  readonly VITE_API_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
