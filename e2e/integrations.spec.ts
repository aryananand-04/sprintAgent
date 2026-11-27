// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import { adminDb, loginAs, skipTour } from './helpers'

test.afterEach(async () => { await adminDb().from('integrations').delete().neq('kind', '') })

test('admin connects Slack: URL is validated, stored server-side and only shown masked', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  await skipTour(ctx)
  const page = await ctx.newPage()
  await loginAs(page, 'admin')
  await page.getByRole('button', { name: 'Agent settings' }).click()

  const field = page.getByLabel('Slack webhook')
  await field.fill('https://evil.example/services/x')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('Slack webhooks start with https://hooks.slack.com/')).toBeVisible()

  await field.fill('https://hooks.slack.com/services/T000/B000/secretTOKEN9')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('https://hooks.slack.com/…KEN9')).toBeVisible()
  // The server never returns the secret, only the masked form.
  const listed = await (await page.request.get('/api/integrations')).text()
  expect(listed).toContain('…KEN9')
  expect(listed).not.toContain('secretTOKEN9')

  const { data } = await adminDb().from('integrations').select('kind, url')
  expect(data).toEqual([{ kind: 'slack_webhook', url: 'https://hooks.slack.com/services/T000/B000/secretTOKEN9' }])
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('hooks.slack.com')
  await ctx.close()
})

test('non-admins cannot read or change integrations', async ({ page }) => {
  await loginAs(page, 'pm')
  expect((await page.request.get('/api/integrations')).status()).toBe(403)
  expect((await page.request.put('/api/integrations', { data: { kind: 'slack_webhook', url: 'https://hooks.slack.com/services/a' } })).status()).toBe(403)
})
