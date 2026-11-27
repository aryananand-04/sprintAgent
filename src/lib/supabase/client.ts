import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/db/database.types'
import { publicEnv } from '@/lib/env'

export const createClient = () =>
  createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
