// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import { loginAs, skipTour } from './helpers'

test.beforeEach(async ({ context }) => skipTour(context))

test('unauthenticated visitors are sent to login with a return path', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('wrong password shows an error without leaking which part was wrong', async ({ page }) => {
  await page.goto('/login')
  await page.getByText('Demo accounts (development only)').click()
  await page.getByLabel('Password', { exact: true }).fill('nope-nope-nope')
  await page.getByRole('button', { name: 'Sign in with password' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid' })).toHaveText('Invalid email or password.')
})

test('PM signs in, sees workspace + role, and signs out', async ({ page }) => {
  await loginAs(page, 'pm')
  await expect(page.getByText('Acme Checkout')).toBeVisible()
  await expect(page.getByText('PM', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/app')
  await expect(page).toHaveURL(/\/login/)
})

test('viewer gets read-only agent settings', async ({ page }) => {
  await loginAs(page, 'viewer')
  await page.getByRole('button', { name: 'Agent settings' }).click()
  await expect(page.getByRole('note')).toContainText('only workspace admins')
})

test('admin can edit agent settings', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.getByRole('button', { name: 'Agent settings' }).click()
  await expect(page.getByText('Agent Settings')).toBeVisible()
  await expect(page.getByRole('note')).toHaveCount(0)
})

test('open redirects are ignored', async ({ page }) => {
  await loginAs(page, 'dev', '/app')
  await page.goto('/login?next=https://evil.example')
  await expect(page).toHaveURL(/\/app$/)
})

test('AI proxy rejects anonymous callers', async ({ request }) => {
  const res = await request.post('/api/chat', { data: { messages: [{ role: 'user', content: 'hi' }] } })
  expect(res.status()).toBe(401)
})
