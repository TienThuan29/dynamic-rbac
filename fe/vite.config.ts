import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/main-api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/main-api/, ''),
      },
      '/auth-api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/auth-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
