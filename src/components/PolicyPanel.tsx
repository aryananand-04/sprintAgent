import { motion } from 'framer-motion'
import { Shield, Zap, HelpCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { AUTONOMY_RULES } from '../logic/autonomy'
import type { AutonomyRule } from '../types'

const CAT_CONFIG = {
  ACT: {
    icon: Zap, solidColor: 'var(--act)', textColor: 'var(--act-t)',
    bg: 'var(--act-bg)', bd: 'var(--act-bd)',
    label: 'Agent Acts Autonomously',
    subtitle: 'No human input needed. Agent assigns, schedules, and reports.',
  },
  ASK: {
    icon: HelpCircle, solidColor: 'var(--ask)', textColor: 'var(--ask-t)',
    bg: 'var(--ask-bg)', bd: 'var(--ask-bd)',
    label: 'Agent Asks Before Acting',
    subtitle: 'Ambiguity detected. Agent pauses and requests clarification.',
  },
  ESCALATE: {
    icon: AlertTriangle, solidColor: 'var(--crit)', textColor: 'var(--esc-t)',
    bg: 'var(--esc-bg)', bd: 'var(--esc-bd)',
    label: 'Agent Escalates to Human',
    subtitle: 'Risk exceeds autonomous threshold. Human judgment required.',
  },
}

const RULE_COUNTS = { ACT: 4, ASK: 3, ESCALATE: 5 }

function RuleRow({ rule, index }: { rule: AutonomyRule; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CAT_CONFIG[rule.category]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        borderRadius: 5, overflow: 'hidden',
        border: `1px solid ${expanded ? cfg.bd : 'var(--b1)'}`,
        background: expanded ? cfg.bg : 'var(--s1)',
        transition: 'border-color 0.12s, background 0.12s',
        boxShadow: '0 1px 2px rgba(9,9,11,0.05)',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500, lineHeight: 1.4, marginBottom: expanded ? 0 : 2 }}>
            {rule.condition}
          </p>
          {!expanded && (
            <p style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {rule.rationale}
            </p>
          )}
        </div>
        <ChevronRight
          size={12}
          style={{ color: 'var(--t3)', flexShrink: 0, marginTop: 2, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ padding: '0 12px 12px', borderTop: '1px solid var(--b1)' }}
        >
          <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65, marginTop: 10, marginBottom: 8 }}>
            {rule.rationale}
          </p>
          <div>
            <div className="label" style={{ marginBottom: 5 }}>Examples</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {rule.examples.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: cfg.solidColor, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{ex}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export function PolicyPanel() {
  const actRules      = AUTONOMY_RULES.filter(r => r.category === 'ACT')
  const askRules      = AUTONOMY_RULES.filter(r => r.category === 'ASK')
  const escalateRules = AUTONOMY_RULES.filter(r => r.category === 'ESCALATE')
  const total = actRules.length + askRules.length + escalateRules.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Shield data-feature-id="autonomy-header" size={13} style={{ color: 'var(--act)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Autonomy Framework</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12 }}>
          The agent's decision-making ruleset. What it owns, when it asks, when it defers.
        </p>

        {/* Distribution bar */}
        <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 5 }}>
          <div style={{ flex: RULE_COUNTS.ACT, background: 'var(--act)', borderRadius: 2 }} />
          <div style={{ flex: RULE_COUNTS.ASK, background: 'var(--warn)', borderRadius: 2 }} />
          <div style={{ flex: RULE_COUNTS.ESCALATE, background: 'var(--crit)', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', fontSize: 9, color: 'var(--t3)', gap: 2 }}>
          <span style={{ flex: RULE_COUNTS.ACT }}>ACT ({RULE_COUNTS.ACT})</span>
          <span style={{ flex: RULE_COUNTS.ASK }}>ASK ({RULE_COUNTS.ASK})</span>
          <span style={{ flex: RULE_COUNTS.ESCALATE }}>ESC ({RULE_COUNTS.ESCALATE})</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Philosophy */}
        <div style={{
          padding: '12px 14px', borderRadius: 5,
          background: 'var(--s2)', borderLeft: '3px solid var(--act)',
        }}>
          <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.7, fontStyle: 'italic' }}>
            "The agent optimizes for <span style={{ color: 'var(--act-t)', fontWeight: 600, fontStyle: 'normal' }}>velocity without overreach</span>. It acts when confidence is high and cost of error is low. It pauses when ambiguity or risk makes human judgment cheaper than autonomous action. Trust is earned incrementally."
          </p>
        </div>

        {/* Rule groups */}
        {([['ACT', actRules], ['ASK', askRules], ['ESCALATE', escalateRules]] as const).map(([cat, rules]) => {
          const cfg = CAT_CONFIG[cat]
          const Icon = cfg.icon
          return (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Icon size={11} style={{ color: cfg.solidColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.textColor, letterSpacing: '-0.01em' }}>{cfg.label}</span>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>— {cfg.subtitle}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rules.map((rule, i) => <RuleRow key={rule.id} rule={rule} index={i} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
