import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
      '/manifest.json': 'http://localhost:8000',
      '/service-worker.js': 'http://localhost:8000',
    },
  },
  build: {
    assetsDir: 'assets',
  },
})
