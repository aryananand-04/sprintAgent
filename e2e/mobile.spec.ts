// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import { loginAs, skipTour } from './helpers'

test('dashboard fits a phone: no sideways scroll, floating controls do not overlap', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await skipTour(ctx)
  const page = await ctx.newPage()
  await loginAs(page, 'pm')
  const simulate = page.getByRole('button', { name: 'Simulate' })
  await expect(simulate).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  const island = page.locator('[data-agent-island]')
  await expect(island).toBeVisible()
  {
    const [a, b] = [await simulate.boundingBox(), await island.first().boundingBox()]
    if (a && b) expect(a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true)
  }
  await ctx.close()
})
