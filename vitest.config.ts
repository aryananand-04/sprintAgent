// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // 'server-only' throws outside the React server build; tests run server code directly.
  resolve: { alias: { '@': path.resolve(__dirname, './src'), 'server-only': path.resolve(__dirname, './src/test/empty.ts') } },
  test: {
    include: ['src/**/*.test.ts'],
    // *.db.test.ts need a running local Supabase: npm run test:db
    exclude: ['**/node_modules/**', ...(process.env.VITEST_DB ? [] : ['**/*.db.test.ts'])],
    setupFiles: process.env.VITEST_DB ? ['./src/test/loadEnv.ts'] : [],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/logic/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // src/logic is the pure decision engine: it must stay near-fully tested.
      thresholds: { lines: 95, branches: 88, functions: 95, statements: 95 },
    },
  },
})
