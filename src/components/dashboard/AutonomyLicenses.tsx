// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useState } from 'react'
import type { AutonomyLicenseView, TaskType } from '../../types'
import { useSprintStore } from '../../store/useSprintStore'
import { useCan } from '../auth/SessionProvider'
import { ENTITLEMENTS, PLAN_NAMES, planWith } from '../../logic/billing'
import {
  ACTIONS, DEFAULT_LEVEL, LEVEL_NAMES, PROMOTION, TASK_TYPES, decisionsNeeded,
  type Level, type LicensedAction,
} from '../../logic/earnedAutonomy'

const LEVEL_TONE: Record<Level, string> = {
  0: 'text-[var(--t3)] bg-[var(--s2)]',
  1: 'text-[var(--ask-t)] bg-[var(--ask-bg)]',
  2: 'text-[var(--act-t)] bg-[var(--act-bg)]',
  3: 'text-[var(--act-t)] bg-[var(--act-bg)] font-bold',
}

const fallback = (taskType: TaskType, action: LicensedAction): AutonomyLicenseView => ({
  taskType, action, earned: DEFAULT_LEVEL, cap: 3, n: 0, agree: 0, lowerBound: 0, reason: 'No evidence yet: the agent is still watching.',
})

function nextStep(l: AutonomyLicenseView): string | null {
  if (!l.n) return null // "no decisions yet" says it; the bars are in the intro
  const up = (l.earned + 1) as Level
  if (up > 3) return 'Top level. Kept while recent decisions keep agreeing.'
  const more = decisionsNeeded(l.agree, l.n, PROMOTION[up as 2 | 3])
  if (!Number.isFinite(more)) return `${LEVEL_NAMES[up]} needs a steadier recent record first.`
  return `${more} more agreeing decision${more === 1 ? '' : 's'} to ${LEVEL_NAMES[up]}.`
}

/** The decision log is hash-chained; PMs can recheck it and take it away as CSV/JSON. */
function TrustLedger() {
  const canAudit = useCan('task:manage')
  const canExport = useSprintStore((s) => ENTITLEMENTS[s.plan].auditExport)
  const [state, setState] = useState<{ busy?: boolean; text?: string; bad?: boolean }>({})
  if (!canAudit) return null
  const verify = async () => {
    setState({ busy: true })
    const r = await fetch('/api/audit/verify').then((x) => (x.ok ? x.json() : null)).catch(() => null) as { checked: number; ok: boolean } | null
    if (!r) return setState({ text: 'Couldn’t run the check. Try again in a moment.', bad: true })
    setState(r.ok
      ? { text: `Intact: all ${r.checked} decisions match their hashes.` }
      : { text: `The chain doesn’t match after decision ${r.checked - 1}. Something was changed after it was written; export the log and contact support.`, bad: true })
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span className="font-semibold text-[var(--t1)]">Decision log</span>
      <button type="button" className="btn btn-secondary !px-2 !py-0.5 !text-[10px]" onClick={verify} disabled={state.busy}>Verify</button>
      {canExport ? (
        <>
          <a className="underline underline-offset-2 text-[var(--t2)]" href="/api/audit/export?format=csv">Export CSV</a>
          <a className="underline underline-offset-2 text-[var(--t2)]" href="/api/audit/export?format=json">JSON</a>
        </>
      ) : (
        <span className="text-[var(--t3)]">Export (CSV, JSON) is on {PLAN_NAMES[planWith('auditExport')]}.</span>
      )}
      <span role="status" className={state.bad ? 'text-[var(--esc)]' : 'text-[var(--t3)]'}>{state.text ?? ''}</span>
    </div>
  )
}

/**
 * The agent's licences: one per task type and action, earned from evidence (its predictions vs what
 * people did), capped by admins, never raised by hand. Each cell shows the numbers behind the level.
 */
export function AutonomyLicenses() {
  const licenses = useSprintStore((s) => s.licenses)
  const isAdmin = useCan('policy:edit')
  const perType = useSprintStore((s) => ENTITLEMENTS[s.plan].perTypePolicy)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const get = (t: TaskType, a: LicensedAction) => licenses.find((l) => l.taskType === t && l.action === a) ?? fallback(t, a)

  // One ceiling for all work (every plan) or one per task type and action (Business). The server checks
  // the plan and writes the change to the decision log; realtime brings the rows back.
  const setCap = async (cap: Level, l?: AutonomyLicenseView) => {
    const key = l ? `${l.taskType}:${l.action}` : 'all'
    setSaving(key); setError(null)
    const res = await fetch('/api/autonomy/ceiling', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(l ? { cap, taskType: l.taskType, action: l.action } : { cap }),
    }).catch(() => null)
    if (!res?.ok) setError((await res?.json().catch(() => null))?.message ?? 'Couldn’t change the ceiling. Try again in a moment.')
    else {
      const hit = (x: AutonomyLicenseView) => !l || (x.taskType === l.taskType && x.action === l.action)
      useSprintStore.setState((s) => {
        const known = s.licenses.map((x) => (hit(x) ? { ...x, cap } : x))
        // Rows the server just created for "all work" (no evidence yet) appear with the new ceiling.
        const added = l ? [] : TASK_TYPES.flatMap((t) => (Object.keys(ACTIONS) as LicensedAction[])
          .filter((a) => !known.some((x) => x.taskType === t && x.action === a)).map((a) => ({ ...fallback(t, a), cap })))
        return { licenses: [...known, ...added] }
      })
    }
    setSaving(null)
  }
  const caps = TASK_TYPES.flatMap((t) => (Object.keys(ACTIONS) as LicensedAction[]).map((a) => get(t, a).cap))
  const allCap = caps[0] as Level
  const uniform = caps.every((c) => c === allCap)

  return (
    <section aria-labelledby="licences-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="licences-heading" className="text-[13px] font-bold tracking-tight text-[var(--t1)]">Licences</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--t3)]">
          What the agent may do on its own, per kind of work. It starts by suggesting; each suggestion a person accepts or overrides is evidence. {LEVEL_NAMES[2]} needs {PROMOTION[2].minN}+ decisions with at least {PROMOTION[2].minLower * 100}% agreement at 95% confidence; {LEVEL_NAMES[3]} needs {PROMOTION[3].minN}+ at {PROMOTION[3].minLower * 100}%. Levels come down when recent decisions stop agreeing, and admins can set a lower ceiling at any time.
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--t2)]">
          <label className="flex items-center gap-1.5">
            <span className="font-semibold text-[var(--t1)]">Ceiling for all work</span>
            <select className="rounded border border-[var(--b1)] bg-[var(--s1)] px-1 py-0.5 text-[11px] text-[var(--t1)]"
              value={uniform ? allCap : ''} disabled={saving === 'all'}
              onChange={(e) => setCap(Number(e.target.value) as Level)}>
              {!uniform && <option value="" disabled>Mixed</option>}
              {([0, 1, 2, 3] as Level[]).map((lv) => <option key={lv} value={lv}>L{lv} {LEVEL_NAMES[lv]}</option>)}
            </select>
          </label>
          <span className="text-[var(--t3)]">
            {perType ? 'Or set one per kind of work below.' : `Restraining the agent is on every plan. A ceiling per kind of work is on ${PLAN_NAMES[planWith('perTypePolicy')]}.`}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-[var(--b1)]">
        <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-[var(--b1)] text-[10px] uppercase tracking-wider text-[var(--t3)]">
              <th scope="col" className="px-3 py-2 font-semibold">Work</th>
              {(Object.keys(ACTIONS) as LicensedAction[]).map((a) => (
                <th key={a} scope="col" className="px-3 py-2 font-semibold">{ACTIONS[a].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TASK_TYPES.map((t) => (
              <tr key={t} className="border-b border-[var(--b0)] last:border-0 align-top">
                <th scope="row" className="px-3 py-2.5 font-semibold capitalize text-[var(--t1)]">{t}</th>
                {(Object.keys(ACTIONS) as LicensedAction[]).map((a) => {
                  const l = get(t, a)
                  const effective = Math.min(l.earned, l.cap) as Level
                  const key = `${t}:${a}`
                  return (
                    <td key={a} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${LEVEL_TONE[effective]}`}>L{effective} {LEVEL_NAMES[effective]}</span>
                        {l.cap < l.earned && <span className="text-[10px] text-[var(--t3)]">earned L{l.earned}, capped</span>}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-[var(--t2)]">
                        {l.n ? `${l.agree}/${l.n} agreed · ≥${Math.round(l.lowerBound * 100)}%` : 'no decisions yet'}
                      </p>
                      {nextStep(l) && <p className="mt-0.5 text-[10px] leading-snug text-[var(--t3)]">{nextStep(l)}</p>}
                      {isAdmin && perType && (
                        <label className="mt-1 flex items-center gap-1 text-[10px] text-[var(--t3)]">
                          Ceiling
                          <select className="rounded border border-[var(--b1)] bg-[var(--s1)] px-1 py-0.5 text-[10px] text-[var(--t1)]"
                            value={l.cap} disabled={saving === key}
                            aria-label={`Ceiling for ${t} ${ACTIONS[a].label.toLowerCase()}`}
                            onChange={(e) => setCap(Number(e.target.value) as Level, l)}>
                            {([0, 1, 2, 3] as Level[]).map((lv) => <option key={lv} value={lv}>L{lv} {LEVEL_NAMES[lv]}</option>)}
                          </select>
                        </label>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-[11px] text-[var(--esc)]">{error}</p>}
      <TrustLedger />
    </section>
  )
}
