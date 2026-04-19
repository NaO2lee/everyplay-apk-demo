import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// safety 버전: 백엔드 20002 / 프론트 20102 (v2.0 포트 재사용)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 20102,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:20002',
        changeOrigin: true,
      },
    },
  },
})
