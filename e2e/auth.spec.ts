import { test, expect, type Page } from '@playwright/test'

// Skip the first-run product tour so it doesn't cover the UI.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('libra-guide-v2', '1') } catch {}
  })
})

async function loginAs(page: Page, who: 'admin' | 'pm' | 'dev' | 'viewer', next = '/app') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByText('Demo accounts (development only)').click()
  await page.getByLabel('Email', { exact: true }).fill(`${who}@demo.sprintagent.dev`)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in with password' }).click()
  await page.waitForURL(`**${next}`)
}

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
