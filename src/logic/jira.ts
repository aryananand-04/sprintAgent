// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { AgentDecision, Task, TaskType, UrgencyLevel } from '../types'
import { trackerTask } from './trackerTask'

/** Atlassian Document Format, as much of it as we read or write. */
export interface AdfNode { type: string; text?: string; attrs?: Record<string, unknown>; content?: AdfNode[] }

export interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description?: AdfNode | string | null
    labels?: string[]
    priority?: { name?: string } | null
    status?: { statusCategory?: { key?: string } } | null
    issuetype?: { name?: string } | null
    created: string
    project?: { key?: string } | null
  }
}

const BLOCKS = new Set(['paragraph', 'heading', 'codeBlock', 'rule', 'tableRow']) // listItem/blockquote wrap paragraphs already

/** Plain text from an ADF document (or a wiki string, which webhooks sometimes send). */
export function adfToText(node: AdfNode | string | null | undefined): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  const walk = (n: AdfNode): string => {
    if (n.type === 'text') return n.text ?? ''
    if (n.type === 'hardBreak') return '\n'
    if (n.type === 'mention' || n.type === 'emoji') return String(n.attrs?.text ?? '')
    const inner = (n.content ?? []).map(walk).join('')
    return BLOCKS.has(n.type) ? `${inner}\n` : inner
  }
  return walk(node).replace(/\n{3,}/g, '\n\n').trim()
}

/** Plain text as an ADF document: blank lines split paragraphs, single newlines become hard breaks. */
export function textToAdf(text: string): AdfNode {
  const paragraphs = text.split(/\n{2,}/).map((p) => ({
    type: 'paragraph',
    content: p.split('\n').flatMap((line, i) => [...(i ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])]),
  }))
  return { type: 'doc', attrs: { version: 1 }, content: paragraphs } as AdfNode
}

export function jiraUrgency(priority: string | undefined): UrgencyLevel | null {
  if (!priority) return null
  if (/highest|blocker|critical|urgent/i.test(priority)) return 'critical'
  if (/high|major/i.test(priority)) return 'high'
  if (/low|minor|trivial/i.test(priority)) return 'low'
  if (/medium|normal/i.test(priority)) return 'medium'
  return null
}

export function jiraType(issuetype: string | undefined): TaskType | null {
  if (!issuetype) return null
  if (/bug|defect|incident/i.test(issuetype)) return 'bug'
  if (/spike|research/i.test(issuetype)) return 'spike'
  if (/story|feature|improvement|epic/i.test(issuetype)) return 'feature'
  return null // "Task" says nothing: let the text decide
}

export const isJiraDone = (i: JiraIssue) => i.fields.status?.statusCategory?.key === 'done'

const JIRA_REF = /^(https:\/\/[\w-]+\.atlassian\.net)\/browse\/([A-Z][A-Z0-9_]*-\d+)$/
export const jiraRef = (siteUrl: string, key: string) => `${siteUrl.replace(/\/$/, '')}/browse/${key}`
export function parseJiraRef(url: string | null | undefined): { site: string; key: string } | null {
  const m = url?.match(JIRA_REF)
  return m ? { site: m[1], key: m[2] } : null
}

export function jiraIssueToTask(i: JiraIssue, siteUrl: string, id: string): Task {
  return trackerTask({
    id, key: i.key, title: i.fields.summary, body: adfToText(i.fields.description), url: jiraRef(siteUrl, i.key),
    source: `Jira / ${i.fields.project?.key ?? i.key.split('-')[0]}`, labels: i.fields.labels ?? [], createdAt: i.fields.created,
    closed: isJiraDone(i), urgency: jiraUrgency(i.fields.priority?.name), type: jiraType(i.fields.issuetype?.name),
  })
}

/** Jira labels can't contain spaces, so ours use dashes. */
export const JIRA_LABELS: Record<AgentDecision, string> = { ACT: 'sprint-agent-ACT', ASK: 'sprint-agent-ASK', ESCALATE: 'sprint-agent-ESCALATE' }

/** The label edit that leaves exactly our one decision label (the issue's own labels untouched). */
export function jiraLabelUpdate(decision: AgentDecision) {
  return (Object.keys(JIRA_LABELS) as AgentDecision[]).map((d) => (d === decision ? { add: JIRA_LABELS[d] } : { remove: JIRA_LABELS[d] }))
}

/** Comments elsewhere use HTML <sub> for the footer; Jira gets plain text. */
export const stripHtml = (s: string) => s.replace(/<\/?[a-z][^>]*>/gi, '')
