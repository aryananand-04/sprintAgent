import { test, expect } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

async function latestLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages } = (await res.json()) as { messages: Array<{ ID: string }> }
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }
      const link = msg.Text.match(/https?:\/\/\S+/)?.[0]
      if (link) return link.replace(/[)\]>]+$/, '')
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no magic link email for ${email}`)
}

test('new user: magic link → onboarding → own workspace as admin', async ({ page }) => {
  await page.context().addInitScript(() => { try { localStorage.setItem('libra-guide-v2', '1') } catch {} })
  const email = `new-${Date.now()}@e2e.test`
  const slug = `e2e-${Date.now()}`

  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByText(`Check ${email}`)).toBeVisible()

  await page.goto(await latestLink(email))
  await expect(page).toHaveURL(/\/onboarding$/)

  await page.getByLabel('Team or company name').fill('E2E Team')
  await page.getByLabel('Workspace URL').fill(slug)
  await page.getByRole('button', { name: 'Create workspace' }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('E2E Team')).toBeVisible()
  await expect(page.getByText('Admin', { exact: true })).toBeVisible()
})

test('workspace URL must be unique', async ({ page }) => {
  const email = `dup-${Date.now()}@e2e.test`
  await page.goto('/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.goto(await latestLink(email))

  await page.getByLabel('Team or company name').fill('Dup')
  await page.getByLabel('Workspace URL').fill('acme-demo')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'taken' })).toBeVisible()
})
