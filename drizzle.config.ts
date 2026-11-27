import { defineConfig } from 'drizzle-kit'

// Migrations are written into supabase/migrations so the Supabase CLI applies them
// (db reset locally, db push in CI/prod). RLS, functions and triggers live in
// hand-written custom migrations alongside.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  migrations: { prefix: 'supabase' },
  schemaFilter: ['public'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
})
