/// <reference types="vite/client" />

import type { User } from "@hously/shared/types";

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __HOUSLY_BOOTSTRAP__?: {
      user: User | null;
    };
  }
}
