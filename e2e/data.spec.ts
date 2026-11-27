import { test, expect } from '@playwright/test'
import { adminDb, loginAs, skipTour, submitIntake, waitForRow } from './helpers'

test.beforeEach(async ({ context }) => skipTour(context))

test('board loads real workspace data from the database', async ({ page }) => {
  await loginAs(page, 'pm')
  await expect(page.getByText('Checkout: Payment fails on iOS after promo code').first()).toBeVisible()
})

test('intake by a PM persists, is triaged, and is audited', async ({ page }) => {
  const title = `E2E persist ${Date.now()}`
  await loginAs(page, 'pm')
  await submitIntake(page, title)

  const db = adminDb()
  await waitForRow(async () => {
    const { data } = await db.from('tasks').select('id, decision').eq('title', title).maybeSingle()
    return !!data?.decision
  })
  const { data: task } = await db.from('tasks').select('id').eq('title', title).single()
  await waitForRow(async () => {
    const { count } = await db.from('decisions').select('*', { count: 'exact', head: true }).eq('task_id', task!.id).eq('kind', 'triage')
    return (count ?? 0) > 0
  })

  await page.reload()
  await page.getByRole('button', { name: 'Intake' }).first().click()
  await expect(page.getByText(title).first()).toBeVisible()
})

test('changes appear live for other members (realtime)', async ({ browser }) => {
  const title = `E2E realtime ${Date.now()}`
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()])
  await Promise.all([skipTour(a), skipTour(b)])
  const [pm, admin] = await Promise.all([a.newPage(), b.newPage()])
  await loginAs(pm, 'pm')
  await loginAs(admin, 'admin')
  await admin.getByRole('button', { name: 'Intake' }).first().click()

  await submitIntake(pm, title)
  await expect(admin.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  await Promise.all([a.close(), b.close()])
})

test('viewer changes are refused and rolled back', async ({ page }) => {
  const title = `E2E viewer ${Date.now()}`
  await loginAs(page, 'viewer')
  await submitIntake(page, title)
  await expect(page.getByRole('status').filter({ hasText: 'View-only' })).toBeVisible()

  const { count } = await adminDb().from('tasks').select('*', { count: 'exact', head: true }).eq('title', title)
  expect(count).toBe(0)
})
