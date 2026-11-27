// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import { loginAs, skipTour } from './helpers'

test('AI triage: the panel explains when the rules overrule the model', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  await skipTour(ctx)
  const page = await ctx.newPage()
  await page.route('**/api/ai/triage', (route) => route.fulfill({
    json: {
      decision: 'ESCALATE', score: 40, reason: 'External blocker. (The model suggested ACT; the rules require ESCALATE.)',
      dimensions: { urgency: 4, impact: 4, effort: 2, risk: 2, clarity: 4 },
      ai: 'ACT', rules: 'ESCALATE', disagreed: true, overruled: true, suspicious: true,
    },
  }))
  await loginAs(page, 'pm')
  await page.getByText('Checkout: Payment fails on iOS after promo code').first().click()
  await page.getByRole('button', { name: /Triage with AI|Re-Triage/ }).click()
  const note = page.getByTestId('triage-audit')
  await expect(note).toContainText('AI suggested ACT, rules said ESCALATE')
  await expect(note).toContainText('looks like instructions to the AI')
  await ctx.close()
})
