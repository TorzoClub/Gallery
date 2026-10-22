/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PREFIX?: string
  readonly VITE_CACHE_WORKER_URL?: string
  readonly VITE_BUILD_DESCRIPTION?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
