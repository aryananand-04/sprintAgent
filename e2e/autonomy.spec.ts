// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { adminDb, loginAs, skipTour, waitForRow } from './helpers'

const WS_SLUG = 'acme-demo'

test.describe('Earned Autonomy', () => {
  test('accepting the agent’s suggestion counts as agreement', async ({ page, context }) => {
    const db = adminDb()
    const ws = (await db.from('workspaces').select('id').eq('slug', WS_SLUG).single()).data!.id
    const sprint = (await db.from('sprints').select('id').eq('workspace_id', ws).eq('status', 'active').single()).data!.id
    const member = (await db.from('team_members').select('id, name').eq('workspace_id', ws).eq('name', 'Dev Mehta').single()).data!
    const taskId = randomUUID()
    const title = `E2E suggest ${Date.now()}`
    await db.from('tasks').insert({ id: taskId, workspace_id: ws, sprint_id: sprint, title, type: 'spike', status: 'triaged', urgency: 'medium', impact: 3, effort: 2, risk: 2, clarity: 4, decision: 'ACT' })
    await db.from('predictions').insert({ workspace_id: ws, task_id: taskId, task_type: 'spike', action: 'assign', mode: 'shadow', predicted_member_id: member.id, confidence: 77, rationale: 'e2e' })

    await skipTour(context)
    await loginAs(page, 'pm')
    await page.getByRole('button', { name: `Accept: assign ${title} to ${member.name}` }).click()
    await waitForRow(async () => (await db.from('predictions').select('outcome').eq('task_id', taskId).single()).data?.outcome === 'agree')
    await expect(page.getByRole('button', { name: `Accept: assign ${title} to ${member.name}` })).toHaveCount(0)
    await db.from('tasks').delete().eq('id', taskId)
  })

  test('licences show the evidence, pass WCAG AA, and the decision log verifies', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    await skipTour(context)
    const page = await context.newPage()
    await loginAs(page, 'admin')
    await page.getByRole('button', { name: 'Autonomy' }).first().click()
    await expect(page.getByRole('heading', { name: 'Licences' })).toBeVisible()
    const bug = page.getByRole('row', { name: /^bug/i })
    await expect(bug).toContainText('L3 Act')
    await expect(bug).toContainText('63/64 agreed')
    await expect(page.getByLabel('Ceiling for bug assign work')).toBeVisible()

    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText(/^Intact: all \d+ decisions match their hashes\.$/)).toBeVisible()

    // Axe reads computed colours: wait until nothing is mid-animation.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    const { violations } = await new AxeBuilder({ page }).include('section[aria-labelledby="licences-heading"]').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    await context.close()
  })
})
