// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import type { Task } from '../../types'
import { useSprintStore } from '../../store/useSprintStore'
import { useCan } from '../auth/SessionProvider'

const hoursLeft = (until: string, now: number) => Math.max(0, Math.ceil((new Date(until).getTime() - now) / 3_600_000))

/**
 * The agent's open prediction for a task: a suggestion people can accept (Suggest mode), or a recent
 * action they can undo (Act-with-undo mode). Either choice is evidence for or against its licence.
 */
export function SuggestionStrip({ task, aboveFooter = false }: { task: Task; aboveFooter?: boolean }) {
  const suggestion = useSprintStore((s) => s.suggestions.find((x) => x.taskId === task.id && x.action === 'assign'))
  const team = useSprintStore((s) => s.team)
  const assign = useSprintStore((s) => s.assignTaskById)
  const undo = useSprintStore((s) => s.undoAgentAssignment)
  const canManage = useCan('task:manage')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  if (!suggestion?.memberId) return null
  const member = team.find((m) => m.id === suggestion.memberId)
  if (!member) return null
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  // On the board it sits just above the card's footer (which has its own rule); elsewhere it opens one.
  const frame = aboveFooter ? 'mb-2' : 'mt-1.5 border-t border-[var(--b0)] pt-1.5'

  if (suggestion.mode === 'shadow' && !task.assigneeId) {
    return (
      <div className={`${frame} flex items-center justify-between gap-2 text-[10px]`} onClick={stop}>
        <span className="truncate text-[var(--t3)]">
          Agent suggests <span className="font-semibold text-[var(--t2)]">{member.name.split(' ')[0]}</span>
          {suggestion.confidence != null && <span className="font-mono"> · {suggestion.confidence}%</span>}
        </span>
        {canManage && (
          <button type="button" className="btn btn-secondary shrink-0 !px-2 !py-0.5 !text-[10px]"
            aria-label={`Accept: assign ${task.title} to ${member.name}`} onClick={() => assign(task.id, member.id)}>
            Accept
          </button>
        )}
      </div>
    )
  }

  if (suggestion.mode === 'acted' && suggestion.undoUntil && task.assigneeId === member.id) {
    const left = hoursLeft(suggestion.undoUntil, now)
    if (!left) return null
    return (
      <div className={`${frame} flex items-center justify-between gap-2 text-[10px]`} onClick={stop}>
        <span className="truncate text-[var(--t3)]">Assigned by the agent · {left}h to undo</span>
        {canManage && (
          <button type="button" className="btn btn-secondary shrink-0 !px-2 !py-0.5 !text-[10px]"
            aria-label={`Undo the agent's assignment of ${task.title}`} onClick={() => undo(task.id, suggestion.previousMemberId)}>
            Undo
          </button>
        )}
      </div>
    )
  }
  return null
}
