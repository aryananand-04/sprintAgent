// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import { generateStandupText, postStandupToSlack } from '../logic/standupUtils'

const LS_KEY = 'agent-standup-posted-date'
const STANDUP_HOUR = 9   // 9am

/**
 * Posts the standup to Slack once per day at or after 9am.
 * Fires on the first app open after 9am — no backend scheduler needed.
 * Tracks "posted today" in localStorage to prevent duplicates.
 */
/** Runs only for roles that may act on the board (PM+); other roles just watch. */
export function useScheduledStandup(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const { tasks, team, sprint, escalations, slackWebhookUrl, addFeedEvent } = useSprintStore.getState()

    if (!slackWebhookUrl) return   // no webhook configured

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)   // YYYY-MM-DD
    const lastPosted = localStorage.getItem(LS_KEY)
    const hour = now.getHours()

    if (lastPosted === todayKey) return          // already posted today
    if (hour < STANDUP_HOUR) return              // too early

    // Time to post
    const text = generateStandupText(tasks, team, sprint, escalations)

    postStandupToSlack(text, slackWebhookUrl)
      .then(() => {
        localStorage.setItem(LS_KEY, todayKey)
        addFeedEvent({
          type: 'status',
          message: `Standup posted to Slack for ${now.toLocaleDateString('en-US', { weekday: 'long' })}. ${team.length} engineers, ${sprint.daysRemaining} days remaining.`,
        })
      })
      .catch(() => {
        // Webhook failed — don't block the app
        addFeedEvent({
          type: 'risk',
          message: 'Scheduled standup failed to post to Slack. Check webhook URL in Settings.',
        })
      })
  }, [enabled])
}
