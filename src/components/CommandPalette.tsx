import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Zap, Inbox, AlertTriangle, BarChart2, Shield, Clock, Flag, BookOpen, Activity, AlertCircle, PaintbrushIcon, Users, MessageCircle, Package, CornerDownLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCommandPaletteStore } from '../store/commandPaletteStore'
import { useSprintStore } from '../store/useSprintStore'

interface Command {
  id: string; label: string; subtitle?: string
  group: 'navigate' | 'scenario' | 'triage' | 'assign'
  icon: LucideIcon; keywords: string[]; action: () => void
}

const GROUP_LABELS: Record<Command['group'], string> = {
  navigate: 'Go to', scenario: 'Trigger', triage: 'Triage', assign: 'Assign',
}

const NAV = [
  { id: 'n-sprint',  label: 'Sprint Board',      icon: Zap,           view: 'sprint'      as const, kw: ['board', 'kanban'] },
  { id: 'n-intake',  label: 'Intake',             icon: Inbox,         view: 'intake'      as const, kw: ['inbox', 'requests'] },
  { id: 'n-triage',  label: 'Triage Queue',       icon: Activity,      view: 'triage'      as const, kw: ['queue', 'act'] },
  { id: 'n-esc',     label: 'Escalations',        icon: AlertTriangle, view: 'escalations' as const, kw: ['blocked', 'human'] },
  { id: 'n-brief',   label: 'Briefings',          icon: BarChart2,     view: 'briefings'   as const, kw: ['standup', 'pm', 'manager'] },
  { id: 'n-review',  label: 'Sprint Review',      icon: Flag,          view: 'review'      as const, kw: ['retro', 'velocity'] },
  { id: 'n-auto',    label: 'Autonomy Framework', icon: Shield,        view: 'autonomy'    as const, kw: ['policy', 'rules'] },
  { id: 'n-time',    label: 'Agent Timeline',     icon: Clock,         view: 'timeline'    as const, kw: ['history', 'audit'] },
  { id: 'n-rat',     label: 'Product Rationale',  icon: BookOpen,      view: 'rationale'   as const, kw: ['thesis', 'why'] },
]

const SCENARIOS = [
  { id: 's-bug',    label: 'Trigger: Urgent Bug',          icon: AlertCircle,    sId: 'urgent-bug',    sub: 'CRITICAL: Checkout 500s' },
  { id: 's-design', label: 'Trigger: Design Blocked',      icon: PaintbrushIcon, sId: 'blocked-design', sub: 'Waiting on sign-off' },
  { id: 's-load',   label: 'Trigger: Engineer Overloaded', icon: Users,          sId: 'overloaded',    sub: 'Dev at 98% capacity' },
  { id: 's-vague',  label: 'Trigger: Vague Request',       icon: MessageCircle,  sId: 'vague-request', sub: '"Make it feel premium"' },
  { id: 's-scope',  label: 'Trigger: Scope Creep',         icon: Package,        sId: 'scope-creep',   sub: '"Quick" loyalty = 8+ days' },
]

export function CommandPalette() {
  const { isOpen, setIsOpen } = useCommandPaletteStore()
  const { tasks, setView, triageTaskById, assignTaskById, triggerScenario } = useSprintStore()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allCmds = useMemo<Command[]>(() => [
    ...NAV.map(n => ({ id: n.id, label: n.label, group: 'navigate' as const, icon: n.icon, keywords: n.kw, action: () => setView(n.view) })),
    ...SCENARIOS.map(s => ({ id: s.id, label: s.label, subtitle: s.sub, group: 'scenario' as const, icon: s.icon, keywords: [s.label, s.sId], action: () => { triggerScenario(s.sId); setView('sprint') } })),
    ...tasks.filter(t => t.status === 'backlog' || t.status === 'triaged').slice(0, 6).map(t => ({
      id: `t-${t.id}`, label: `Triage: ${t.title.slice(0, 44)}${t.title.length > 44 ? '…' : ''}`,
      subtitle: `${t.urgency} · ${t.type}`, group: 'triage' as const, icon: Activity,
      keywords: ['triage', t.type, t.urgency], action: () => void triageTaskById(t.id),
    })),
    ...tasks.filter(t => t.decision === 'ACT' && !t.assigneeId && t.status !== 'done').slice(0, 5).map(t => ({
      id: `a-${t.id}`, label: `Assign: ${t.title.slice(0, 44)}${t.title.length > 44 ? '…' : ''}`,
      subtitle: 'Auto-assign best fit', group: 'assign' as const, icon: Zap,
      keywords: ['assign', t.type], action: () => assignTaskById(t.id),
    })),
  ], [tasks])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCmds
    const q = query.toLowerCase()
    return allCmds.filter(c => c.label.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q) || c.keywords.some(k => k.toLowerCase().includes(q)))
  }, [query, allCmds])

  const grouped = useMemo(() => {
    const order: Command['group'][] = ['navigate', 'scenario', 'triage', 'assign']
    return order.flatMap(g => { const c = filtered.filter(x => x.group === g); return c.length ? [[g, c] as [Command['group'], Command[]]] : [] })
  }, [filtered])

  useEffect(() => setSel(0), [query])
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsOpen(!isOpen) } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [isOpen, setIsOpen])
  useEffect(() => { if (isOpen) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setSel(0) } }, [isOpen])
  useEffect(() => { listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const exec = (c: Command) => { c.action(); setIsOpen(false); setQuery('') }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            style={{
              position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
              zIndex: 61, width: 520, maxWidth: '90vw',
              background: 'var(--card)',
              /* #6 — stronger border + layered shadow */
              border: '1px solid var(--b2)',
              borderRadius: 8,
              boxShadow: '0 0 0 1px rgba(9,9,11,0.08), 0 8px 24px rgba(9,9,11,0.18), 0 24px 48px rgba(9,9,11,0.10)',
              overflow: 'hidden',
            }}
          >
            {/* Search — #6 focus ring */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderBottom: '1px solid var(--b1)',
              background: 'var(--card)',
            }}>
              {/* #11 — strokeWidth 1.5 */}
              <Search size={14} style={{ color: 'var(--t2)', flexShrink: 0 }} strokeWidth={1.5} />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setIsOpen(false); return }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, filtered.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter' && filtered[sel]) { e.preventDefault(); exec(filtered[sel]) }
                }}
                placeholder="Search views, actions, tasks…"
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  /* #6 — visible focus ring */
                  outline: 'none',
                  fontSize: 14, color: 'var(--t1)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              />
              <kbd style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 6px',
                borderRadius: 4, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t3)', flexShrink: 0,
              }}>esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ maxHeight: 340, overflowY: 'auto', padding: '4px 0' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                  No results for "<span style={{ color: 'var(--t2)' }}>{query}</span>"
                </div>
              ) : grouped.map(([g, cmds]) => (
                <div key={g}>
                  <div style={{
                    padding: '8px 14px 3px',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.10em', color: 'var(--t3)',
                  }}>{GROUP_LABELS[g]}</div>
                  {cmds.map(cmd => {
                    const Icon = cmd.icon
                    const idx = filtered.indexOf(cmd)
                    const isSel = idx === sel
                    return (
                      <button key={cmd.id} data-sel={isSel} onClick={() => exec(cmd)} onMouseEnter={() => setSel(idx)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 14px', cursor: 'pointer', textAlign: 'left',
                          /* #6 — selected row uses act-bg + left accent stripe */
                          background: isSel ? 'rgba(12,102,228,0.06)' : 'transparent',
                          borderLeft: isSel ? '3px solid var(--act)' : '3px solid transparent',
                          paddingLeft: isSel ? 11 : 14,
                          border: 'none', transition: 'background 0.08s, border-color 0.08s',
                        }}
                      >
                        <div style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: 4,
                          background: isSel ? 'var(--act-bg)' : 'var(--s2)',
                          border: `1px solid ${isSel ? 'var(--act-bd)' : 'var(--b1)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {/* #11 — strokeWidth 1.5 */}
                          <Icon size={12} style={{ color: isSel ? 'var(--act-t)' : 'var(--t2)' }} strokeWidth={1.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: isSel ? 600 : 500, color: isSel ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.008em' }}>{cmd.label}</div>
                          {cmd.subtitle && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{cmd.subtitle}</div>}
                        </div>
                        {isSel && <CornerDownLeft size={11} style={{ color: 'var(--act-t)', flexShrink: 0 }} strokeWidth={1.5} />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '7px 14px', borderTop: '1px solid var(--b0)', display: 'flex', alignItems: 'center', gap: 14 }}>
              {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([k, l]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--t3)' }}>
                  <kbd style={{ fontFamily: 'monospace', padding: '1px 4px', borderRadius: 3, background: 'var(--s2)', border: '1px solid var(--b1)' }}>{k}</kbd> {l}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>{filtered.length}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
