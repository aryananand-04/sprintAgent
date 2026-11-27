import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const axe = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()

test('landing demo triages examples with the real rule engine', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('you can audit')

  await page.getByRole('button', { name: 'Blocked ask' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Escalate' })).toHaveAttribute('aria-current', 'true')

  await page.getByRole('button', { name: 'Bug report' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Act' }).first()).toHaveAttribute('aria-current', 'true')

  await page.getByLabel('Paste a messy request').fill('fix it')
  await page.getByRole('button', { name: /Triage it/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Escalate' })).toHaveAttribute('aria-current', 'true')
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

for (const path of ['/', '/pricing', '/login']) {
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
