import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteAiBffPlugin } from './src/server/ai/viteAiBffPlugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteAiBffPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
