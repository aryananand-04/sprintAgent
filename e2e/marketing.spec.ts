// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const axe = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()

test('landing demo triages examples with the real rule engine', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('you can audit')

  await page.getByRole('button', { name: 'Blocked ask' }).click()
  await expect(page.getByRole('list', { name: 'Possible decisions' }).getByRole('listitem').filter({ hasText: 'Escalate' })).toHaveAttribute('aria-current', 'true')

  await page.getByRole('button', { name: 'Bug report' }).click()
  await expect(page.getByRole('list', { name: 'Possible decisions' }).getByRole('listitem').filter({ hasText: 'Act' })).toHaveAttribute('aria-current', 'true')

  await page.getByLabel('Paste a messy request').fill('fix it')
  await page.getByRole('button', { name: /Triage it/ }).click()
  await expect(page.getByRole('list', { name: 'Possible decisions' }).getByRole('listitem').filter({ hasText: 'Escalate' })).toHaveAttribute('aria-current', 'true')
})

test('loop tabs are keyboard navigable', async ({ page }) => {
  await page.goto('/')
  const first = page.getByRole('tab', { name: /Intake/ })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Triage/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: /Triage/ })).toBeFocused()
})

test('mobile menu opens and links work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.locator('#mobile-nav').getByRole('link', { name: 'Pricing' }).click()
  await expect(page).toHaveURL(/\/pricing$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pay for the people')
})

test('no horizontal scroll on phones', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of ['/', '/pricing', '/login']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

for (const path of ['/', '/pricing', '/login', '/try', '/does-not-exist']) {
  for (const theme of ['light', 'dark'] as const) {
    test(`a11y: ${path} (${theme}) has no WCAG AA violations`, async ({ page }) => {
      await page.goto(path)
      if (theme === 'dark') {
        await page.evaluate(() => document.documentElement.classList.add('dark'))
        await page.waitForTimeout(500) // let colour transitions settle before measuring contrast
      }
      const { violations } = await axe(page)
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
    })
  }
}

test('demo plays itself, then hands control to the visitor', async ({ page }) => {
  await page.goto('/')
  const box = page.getByLabel('Paste a messy request')
  await expect(page.getByText(/typing by itself/)).toBeVisible()
  await expect(box).not.toHaveValue(/premium/, { timeout: 8_000 }) // moved on to the next example

  await box.click()
  await expect(page.getByText(/typing by itself/)).toHaveCount(0)
  await box.fill('fix it')
  await page.waitForTimeout(4_000)
  await expect(box).toHaveValue('fix it') // autoplay did not overwrite the visitor
})

test('reduced motion: no autoplay, content fully visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.getByText(/typing by itself/)).toBeHidden()
  await page.waitForTimeout(3_500)
  await expect(page.getByLabel('Paste a messy request')).toHaveValue(/premium/)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByRole('heading', { name: /Point it at your backlog/ })).toBeVisible()
  await ctx.close()
})

test('standup calculator reacts to inputs', async ({ page }) => {
  await page.goto('/')
  const people = page.getByLabel('People in the meeting')
  // Inputs filled before hydration are lost, so retry until React has picked up the change.
  await expect(async () => {
    await people.fill('30')
    await expect(page.getByText(/full-time engineer, standing in a circle/)).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await people.fill('2')
  await page.getByLabel('Minutes it actually takes').fill('5')
  await expect(page.getByText(/That’s reasonable/)).toBeVisible()
})

test('try: triages a public repo (GitHub mocked) and filters by decision', async ({ page }) => {
  await page.route('https://api.github.com/repos/acme/shop/issues**', (route) => route.fulfill({
    json: [
      { number: 1, title: 'Checkout crashes on iOS when applying promo code', body: 'Steps to reproduce: 1) add item 2) apply SAVE10. Expected: discount. Actual: crash. Sentry CHK-4421. Affects 12% of users.', html_url: 'https://github.com/acme/shop/issues/1', labels: [{ name: 'bug' }] },
      { number: 2, title: 'make the cart feel more premium', body: null, html_url: 'https://github.com/acme/shop/issues/2', labels: [] },
      { number: 3, title: 'Rotate session tokens', body: 'Needs legal sign-off before release.', html_url: 'https://github.com/acme/shop/issues/3', labels: [] },
      { number: 4, title: 'A pull request', body: '', html_url: 'x', labels: [], pull_request: {} },
    ],
  }))
  await page.goto('/try')
  await page.getByLabel('Public GitHub repository').fill('https://github.com/acme/shop')
  await page.getByRole('button', { name: 'Triage my backlog' }).click()
  await expect(page).toHaveURL(/\/try\?repo=acme%2Fshop/)
  await expect(page.getByRole('heading', { name: 'acme/shop' })).toBeVisible()
  await expect(page.getByText('3 open issues, triaged.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: /^Escalate \d+$/ }).click()
  await expect(page.getByText('Rotate session tokens')).toBeVisible()
  await expect(page.getByText(/Who owns the legal sign-off/)).toBeVisible()
  await expect(page.getByText('Checkout crashes on iOS when applying promo code')).toHaveCount(0)
  await page.getByRole('button', { name: /^Act \d+$/ }).click()
  await expect(page.getByText('Checkout crashes on iOS when applying promo code')).toBeVisible()
})

test('try: friendly errors for missing repos and rate limits', async ({ page }) => {
  await page.route('https://api.github.com/repos/nope/gone/issues**', (r) => r.fulfill({ status: 404, json: {} }))
  await page.goto('/try?repo=nope/gone')
  await expect(page.getByRole('alert').filter({ hasText: 'public' })).toContainText('Is it public')
  await page.route('https://api.github.com/repos/busy/repo/issues**', (r) => r.fulfill({ status: 403, json: {}, headers: { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) } }))
  await page.goto('/try?repo=busy/repo')
  await expect(page.getByRole('alert').filter({ hasText: 'limit' })).toContainText('anonymous limit')
})

test('try: rejects input that is not a repo', async ({ page }) => {
  await page.goto('/try')
  await page.getByLabel('Public GitHub repository').fill('not a repo')
  await page.getByRole('button', { name: 'Triage my backlog' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'owner' })).toContainText('owner/name')
})

test('404 is on-brand and helpful', async ({ page }) => {
  const res = await page.goto('/definitely-not-here')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'This page got escalated.' })).toBeVisible()
})
