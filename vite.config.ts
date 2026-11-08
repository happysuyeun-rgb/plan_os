import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteAiBffPlugin } from './src/server/ai/viteAiBffPlugin'

export default defineConfig(({ mode }) => {
  // Load all .env* keys into process.env so the AI BFF middleware can read GEMINI_API_KEY.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return {
    plugins: [react(), tailwindcss(), viteAiBffPlugin()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
  }
})
