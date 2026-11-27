// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import { generateStandupText } from '../services/standupUtils'
import { sendEvent } from '../services/outbox'

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
    const { tasks, team, sprint, escalations, addFeedEvent } = useSprintStore.getState()

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)   // YYYY-MM-DD
    const lastPosted = localStorage.getItem(LS_KEY)
    const hour = now.getHours()

    if (lastPosted === todayKey) return          // already posted today
    if (hour < STANDUP_HOUR) return              // too early

    // Time to post
    const text = generateStandupText(tasks, team, sprint, escalations)

    // The server skips this if no Slack webhook is set or another PM already posted today.
    sendEvent({ type: 'standup', text })
      .then((queued) => {
        localStorage.setItem(LS_KEY, todayKey)
        if (!queued) return
        addFeedEvent({
          type: 'status',
          message: `Standup posted to Slack for ${now.toLocaleDateString('en-US', { weekday: 'long' })}. ${team.length} engineers, ${sprint.daysRemaining} days remaining.`,
        })
      })
      .catch(() => {
        // Webhook failed — don't block the app
        addFeedEvent({
          type: 'risk',
          message: 'Couldn’t queue the standup for Slack. It will try again tomorrow.',
        })
      })
  }, [enabled])
}
