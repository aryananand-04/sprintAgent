// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { expect, type Page, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

export type DemoUser = 'admin' | 'pm' | 'dev' | 'viewer'

export async function skipTour(context: BrowserContext) {
  await context.addInitScript(() => {
    try { localStorage.setItem('libra-guide-v2', '1') } catch { /* private mode */ }
  })
}

export async function loginAs(page: Page, who: DemoUser, next = '/app') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByText('Demo accounts (development only)').click()
  await page.getByLabel('Email', { exact: true }).fill(`${who}@demo.sprintagent.dev`)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in with password' }).click()
  await page.waitForURL(`**${next}`)
}

export async function submitIntake(page: Page, text: string) {
  await page.getByRole('button', { name: 'Intake' }).first().click()
  await page.getByPlaceholder(/Describe the request/).fill(text)
  await page.getByRole('button', { name: /Hand off to Agent/ }).click()
}

/** Service client for assertions only (reads .env.local written by `npm run db:env`). */
export function adminDb() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
}

export async function waitForRow(check: () => Promise<boolean>, timeout = 8_000) {
  await expect.poll(check, { timeout }).toBe(true)
}
