import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8666',
      '/ws': { target: 'ws://127.0.0.1:8666', ws: true },
    },
  },
  build: { outDir: '../wraith/static', emptyOutDir: true },
})
