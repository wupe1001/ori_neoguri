/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 'real': 실제 백엔드 / 'mock' 또는 비어 있음: 목업
  readonly VITE_API_MODE?: 'real' | 'mock'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
