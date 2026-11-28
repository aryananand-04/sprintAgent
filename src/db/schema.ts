// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, bigint, smallint, boolean, timestamp, date, jsonb,
  primaryKey, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'

/* ── Enums (mirror src/types) ─────────────────────────────────────────── */
// Order matters: RLS compares roles with >= (viewer < contributor < pm < admin).
export const workspaceRole = pgEnum('workspace_role', ['viewer', 'contributor', 'pm', 'admin'])
export const taskStatus = pgEnum('task_status', ['backlog', 'triaged', 'assigned', 'in-progress', 'blocked', 'done'])
export const taskType = pgEnum('task_type', ['bug', 'feature', 'spike', 'design', 'urgent', 'ad-hoc', 'chore'])
export const urgency = pgEnum('urgency', ['critical', 'high', 'medium', 'low'])
export const agentDecision = pgEnum('agent_decision', ['ACT', 'ASK', 'ESCALATE'])
export const adHocResolution = pgEnum('ad_hoc_resolution', ['absorb', 'swap', 'escalate'])
export const health = pgEnum('sprint_health', ['green', 'yellow', 'red'])
export const sprintStatus = pgEnum('sprint_status', ['planned', 'active', 'archived'])
export const escalationCategory = pgEnum('escalation_category', [
  'missing-criteria', 'scope-conflict', 'blocker', 'capacity', 'ambiguous', 'stakeholder',
])
export const feedType = pgEnum('feed_type', ['assign', 'escalate', 'triage', 'status', 'risk', 'adHoc', 'resolve', 'intake'])
export const decisionKind = pgEnum('decision_kind', ['triage', 'assign', 'rebalance', 'escalate', 'ad-hoc', 'override'])
export const decisionSource = pgEnum('decision_source', ['ai', 'rules', 'human'])

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const workspaceId = () =>
  uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' })
const score15 = (name: string) => smallint(name).notNull()

/* ── Tenancy ──────────────────────────────────────────────────────────── */
export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  /** IANA zone for local-time work (the 9am standup). Validated by the app; unknown zones act as UTC. */
  timezone: text('timezone').notNull().default('UTC'),
  createdBy: uuid('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('workspaces_slug_key').on(t.slug),
  check('workspaces_slug_format', sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,47}$'`),
])

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: workspaceId(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  role: workspaceRole('role').notNull().default('contributor'),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
  index('workspace_members_user_idx').on(t.userId),
])

/* ── Sprint domain ────────────────────────────────────────────────────── */
export const teamMembers = pgTable('team_members', {
  id: id(),
  workspaceId: workspaceId(),
  userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  title: text('title').notNull(),
  skills: text('skills').array().notNull().default(sql`'{}'`),
  currentLoad: smallint('current_load').notNull().default(0),
  capacity: integer('capacity').notNull().default(0),
  color: text('color').notNull(),
  createdAt: createdAt(),
}, (t) => [
  index('team_members_ws_idx').on(t.workspaceId),
  uniqueIndex('team_members_ws_user_key').on(t.workspaceId, t.userId),
  check('team_members_load_range', sql`${t.currentLoad} between 0 and 100`),
])

export const sprints = pgTable('sprints', {
  id: id(),
  workspaceId: workspaceId(),
  name: text('name').notNull(),
  goal: text('goal').notNull().default(''),
  status: sprintStatus('status').notNull().default('planned'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  totalPoints: integer('total_points').notNull().default(0),
  committedPoints: integer('committed_points').notNull().default(0),
  completedPoints: integer('completed_points').notNull().default(0),
  velocity: integer('velocity').notNull().default(0),
  health: health('health').notNull().default('green'),
  snapshot: jsonb('snapshot'), // frozen state at archive time
  createdAt: createdAt(),
}, (t) => [
  index('sprints_ws_idx').on(t.workspaceId),
  // At most one active sprint per workspace.
  uniqueIndex('sprints_one_active_per_ws').on(t.workspaceId).where(sql`${t.status} = 'active'`),
  check('sprints_dates', sql`${t.endDate} >= ${t.startDate}`),
])

export const tasks = pgTable('tasks', {
  id: id(),
  workspaceId: workspaceId(),
  sprintId: uuid('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  type: taskType('type').notNull(),
  status: taskStatus('status').notNull().default('backlog'),
  urgency: urgency('urgency').notNull().default('medium'),
  impact: score15('impact'),
  effort: score15('effort'),
  risk: score15('risk'),
  clarity: score15('clarity'),
  assigneeId: uuid('assignee_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  externalBlockers: text('external_blockers').array().notNull().default(sql`'{}'`),
  source: text('source').notNull().default('PM'),
  externalRef: text('external_ref'), // e.g. GitHub issue URL
  storyPoints: smallint('story_points'),
  tags: text('tags').array().notNull().default(sql`'{}'`),
  decision: agentDecision('decision'),
  decisionReason: text('decision_reason'),
  triageScore: smallint('triage_score'),
  confidence: smallint('confidence'),
  isAiTriaged: boolean('is_ai_triaged').notNull().default(false),
  isAdHoc: boolean('is_ad_hoc').notNull().default(false),
  adHocResolution: adHocResolution('ad_hoc_resolution'),
  adHocSwappedTaskId: uuid('ad_hoc_swapped_task_id'),
  goalAlignment: smallint('goal_alignment'),
  acceptanceCriteria: text('acceptance_criteria').array(),
  completedAt: timestamp('completed_at', { withTimezone: true }), // maintained by trigger
  createdBy: uuid('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('tasks_ws_status_idx').on(t.workspaceId, t.status),
  index('tasks_sprint_idx').on(t.sprintId),
  index('tasks_assignee_idx').on(t.assigneeId),
  uniqueIndex('tasks_ws_external_ref_key').on(t.workspaceId, t.externalRef),
  check('tasks_dims_range', sql`${t.impact} between 1 and 5 and ${t.effort} between 1 and 5 and ${t.risk} between 1 and 5 and ${t.clarity} between 1 and 5`),
  check('tasks_score_range', sql`${t.triageScore} is null or ${t.triageScore} between 0 and 100`),
  check('tasks_confidence_range', sql`${t.confidence} is null or ${t.confidence} between 0 and 100`),
  check('tasks_goal_alignment_range', sql`${t.goalAlignment} is null or ${t.goalAlignment} between 1 and 10`),
])

export const taskDependencies = pgTable('task_dependencies', {
  workspaceId: workspaceId(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnTaskId: uuid('depends_on_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.dependsOnTaskId] }),
  index('task_dependencies_depends_on_idx').on(t.dependsOnTaskId),
  check('task_dependencies_no_self', sql`${t.taskId} <> ${t.dependsOnTaskId}`),
])

export const taskComments = pgTable('task_comments', {
  id: id(),
  workspaceId: workspaceId(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => authUsers.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(), // display name; 'Agent' for agent comments
  body: text('body').notNull(),
  createdAt: createdAt(),
}, (t) => [index('task_comments_task_idx').on(t.taskId, t.createdAt)])

export const escalations = pgTable('escalations', {
  id: id(),
  workspaceId: workspaceId(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  taskTitle: text('task_title').notNull(),
  reason: text('reason').notNull(),
  recommendation: text('recommendation').notNull(),
  urgency: urgency('urgency').notNull(),
  category: escalationCategory('category').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => authUsers.id, { onDelete: 'set null' }),
  resolution: text('resolution'),
  createdAt: createdAt(),
}, (t) => [
  index('escalations_ws_open_idx').on(t.workspaceId).where(sql`${t.resolvedAt} is null`),
])

/* ── Agent audit (append-only; foundation for Earned Autonomy in P5) ─── */
export const decisions = pgTable('decisions', {
  id: id(),
  workspaceId: workspaceId(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  kind: decisionKind('kind').notNull(),
  source: decisionSource('source').notNull(),
  decision: agentDecision('decision'),
  rationale: text('rationale').notNull(),
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  actorId: uuid('actor_id').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [index('decisions_ws_created_idx').on(t.workspaceId, t.createdAt)])

export const feedEvents = pgTable('feed_events', {
  id: id(),
  workspaceId: workspaceId(),
  type: feedType('type').notNull(),
  message: text('message').notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  memberId: uuid('member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  decision: agentDecision('decision'),
  createdAt: createdAt(),
}, (t) => [index('feed_events_ws_created_idx').on(t.workspaceId, t.createdAt)])

/* ── Policy & calibration ─────────────────────────────────────────────── */
export const autonomyPolicies = pgTable('autonomy_policies', {
  workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  actMinClarity: smallint('act_min_clarity').notNull().default(3),
  askMaxClarity: smallint('ask_max_clarity').notNull().default(2),
  escalateIfCriticalUnassignedHours: smallint('escalate_if_critical_unassigned_hours').notNull().default(1),
  neverAutoAssignTypes: taskType('never_auto_assign_types').array().notNull().default(sql`'{}'`),
  capacityBreachThreshold: smallint('capacity_breach_threshold').notNull().default(90),
  blockedHoursThreshold: smallint('blocked_hours_threshold').notNull().default(2),
  escNudgeHours: smallint('esc_nudge_hours').notNull().default(4),
  velocityDeficitPts: smallint('velocity_deficit_pts').notNull().default(6),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by').references(() => authUsers.id, { onDelete: 'set null' }),
}, (t) => [
  check('autonomy_clarity_order', sql`${t.askMaxClarity} < ${t.actMinClarity} and ${t.actMinClarity} between 1 and 5`),
])

export const calibration = pgTable('calibration', {
  workspaceId: workspaceId(),
  decision: agentDecision('decision').notNull(),
  correct: integer('correct').notNull().default(0),
  total: integer('total').notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.decision] }),
  check('calibration_counts', sql`${t.correct} between 0 and ${t.total}`),
])

// ── Integrations & outbox (P4) ─────────────────────────────────────────────
export const integrationKind = pgEnum('integration_kind', ['slack_webhook', 'outbound_webhook'])
export const outboxStatus = pgEnum('outbox_status', ['pending', 'sent', 'dead'])

/** One per workspace and kind. `url` is a secret: only admins can read it (RLS). */
export const integrations = pgTable('integrations', {
  id: id(),
  workspaceId: workspaceId(),
  kind: integrationKind('kind').notNull(),
  url: text('url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('integrations_ws_kind_uq').on(t.workspaceId, t.kind)])

/** Durable delivery queue. Written and delivered by the server only; PMs can read status. */
export const outbox = pgTable('outbox', {
  id: id(),
  workspaceId: workspaceId(),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  status: outboxStatus('status').notNull().default('pending'),
  attempts: smallint('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('outbox_due_idx').on(t.status, t.nextAttemptAt)])

/** Agent check cooldowns, shared by every runner so a check fires once per workspace, not once per browser. */
export const agentCooldowns = pgTable('agent_cooldowns', {
  workspaceId: workspaceId(),
  key: text('key').notNull(),
  firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.key] })])

/** A GitHub App installation linked to a workspace. One installation belongs to one workspace. */
export const githubInstallations = pgTable('github_installations', {
  id: id(),
  workspaceId: workspaceId(),
  installationId: bigint('installation_id', { mode: 'number' }).notNull(),
  accountLogin: text('account_login').notNull(),
  connectedBy: uuid('connected_by').references(() => authUsers.id, { onDelete: 'set null' }),
  /** Post triage labels and ASK questions back to GitHub. Public action, so off until an admin turns it on. */
  writeBack: boolean('write_back').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('github_installations_installation_key').on(t.installationId)])

/**
 * The Sprint Agent Slack app installed in a Slack team, linked to one workspace (and vice versa).
 * The bot token is sealed (AES-256-GCM) by the server and never readable by users (column grants).
 */
export const slackInstallations = pgTable('slack_installations', {
  id: id(),
  workspaceId: workspaceId(),
  teamId: text('team_id').notNull(),
  teamName: text('team_name').notNull(),
  botUserId: text('bot_user_id').notNull(),
  botTokenSealed: text('bot_token_sealed').notNull(),
  /** Channel chosen at install for escalations and the standup. */
  channelId: text('channel_id'),
  channelName: text('channel_name'),
  connectedBy: uuid('connected_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('slack_installations_team_key').on(t.teamId),
  uniqueIndex('slack_installations_workspace_key').on(t.workspaceId),
])
