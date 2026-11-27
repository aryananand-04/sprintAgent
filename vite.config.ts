/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { handleChat } from './server/llm'

/** Serves /api/chat in dev with the same handler Vercel uses in prod. Key never reaches the client. */
function devApi(apiKey: string | undefined): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body: unknown = null
        try { body = JSON.parse(raw) } catch { /* invalid JSON → 400 from handler */ }
        const out = await handleChat(body, apiKey)
        res.statusCode = out.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(out.body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env.GROQ_API_KEY)],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
      environment: 'node',
    },
  }
})
