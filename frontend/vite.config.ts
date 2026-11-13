import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 백엔드가 CORS를 허용하지 않으므로 /api 요청은 개발 서버가 대신 전달한다.
      // 브라우저 입장에서는 같은 주소라 로그인 쿠키도 그대로 쓸 수 있다.
      proxy: env.API_PROXY_TARGET
        ? { '/api': { target: env.API_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
  }
})
