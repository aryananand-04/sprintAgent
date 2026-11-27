// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Database tests talk to the local Supabase; load its keys before any module reads the env.
import { existsSync } from 'node:fs'

if (!process.env.SUPABASE_SECRET_KEY && existsSync('.env.local')) process.loadEnvFile('.env.local')
