// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, bigint, smallint, boolean, timestamp, date, jsonb, real,
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
export const decisionKind = pgEnum('decision_kind', ['triage', 'assign', 'rebalance', 'escalate', 'ad-hoc', 'override', 'license'])
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
  /**
   * Trust ledger (set by trigger): immutable copies of the task and actor ids (the FKs above are nulled
   * when a task or user is deleted), the position in the workspace's chain, and sha256 over the
   * previous hash + this row.
   */
  subjectId: uuid('subject_id'),
  actorRef: uuid('actor_ref'),
  chainIndex: bigint('chain_index', { mode: 'number' }),
  prevHash: text('prev_hash'),
  hash: text('hash'),
}, (t) => [
  index('decisions_ws_created_idx').on(t.workspaceId, t.createdAt),
  uniqueIndex('decisions_chain_key').on(t.workspaceId, t.chainIndex),
])

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
  /** Daily 9am DM to each linked person with their own work. Off until an admin turns it on. */
  dmBriefings: boolean('dm_briefings').notNull().default(false),
  connectedBy: uuid('connected_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('slack_installations_team_key').on(t.teamId),
  uniqueIndex('slack_installations_workspace_key').on(t.workspaceId),
])

export const trackerKind = pgEnum('tracker_kind', ['linear', 'jira'])

/**
 * A Linear organization or Jira site linked to a workspace (one of each kind per workspace; one
 * workspace per external org). OAuth tokens are sealed by the server and never readable by users.
 */
export const trackerConnections = pgTable('tracker_connections', {
  id: id(),
  workspaceId: workspaceId(),
  kind: trackerKind('kind').notNull(),
  /** Linear organization id / Jira cloud id. */
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  /** Linear: https://linear.app/<urlKey>; Jira: https://<site>.atlassian.net. */
  siteUrl: text('site_url').notNull(),
  accessTokenSealed: text('access_token_sealed').notNull(),
  refreshTokenSealed: text('refresh_token_sealed'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  /** Post triage labels and ASK questions back. Visible to everyone in the tracker, so off by default. */
  writeBack: boolean('write_back').notNull().default(false),
  /** Provider bookkeeping (Jira webhook ids and their refresh time). */
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  connectedBy: uuid('connected_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('tracker_connections_external_key').on(t.kind, t.externalId),
  uniqueIndex('tracker_connections_workspace_key').on(t.workspaceId, t.kind),
])

/* ── Earned Autonomy (P5) ─────────────────────────────────────────────── */
export const licensedAction = pgEnum('licensed_action', ['assign', 'rebalance'])
export const predictionMode = pgEnum('prediction_mode', ['shadow', 'acted'])
export const predictionOutcome = pgEnum('prediction_outcome', ['agree', 'disagree', 'expired'])

/**
 * What the agent would do (shadow) or did (acted) for one task, and what people then did. Resolved by
 * a trigger on tasks when a person assigns or moves the work, so evidence can't be faked by the client.
 */
export const predictions = pgTable('predictions', {
  id: id(),
  workspaceId: workspaceId(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  taskType: taskType('task_type').notNull(),
  action: licensedAction('action').notNull(),
  mode: predictionMode('mode').notNull(),
  predictedMemberId: uuid('predicted_member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  previousMemberId: uuid('previous_member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  confidence: smallint('confidence'),
  rationale: text('rationale').notNull(),
  /** L2: people can undo until then without it counting as an incident... it still counts as a disagreement. */
  undoUntil: timestamp('undo_until', { withTimezone: true }),
  outcome: predictionOutcome('outcome'),
  actualMemberId: uuid('actual_member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
  resolvedBy: uuid('resolved_by').references(() => authUsers.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index('predictions_ws_resolved_idx').on(t.workspaceId, t.resolvedAt),
  uniqueIndex('predictions_open_key').on(t.taskId, t.action).where(sql`${t.outcome} is null`),
])

/** The agent's licence per task type and action: earned from evidence, capped by an admin. */
export const autonomyLicenses = pgTable('autonomy_licenses', {
  workspaceId: workspaceId(),
  taskType: taskType('task_type').notNull(),
  action: licensedAction('action').notNull(),
  earnedLevel: smallint('earned_level').notNull().default(1),
  cap: smallint('cap').notNull().default(3),
  n: integer('n').notNull().default(0),
  agree: integer('agree').notNull().default(0),
  lowerBound: real('lower_bound').notNull().default(0),
  reason: text('reason').notNull().default('No evidence yet: the agent is still watching.'),
  changedAt: timestamp('changed_at', { withTimezone: true }),
  updatedAt: updatedAt(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.taskType, t.action] }),
  check('licenses_levels', sql`${t.earnedLevel} between 0 and 3 and ${t.cap} between 0 and 3`),
  check('licenses_counts', sql`${t.agree} between 0 and ${t.n}`),
])

/* ── Billing ──────────────────────────────────────────────────────────── */
export const billingPlan = pgEnum('billing_plan', ['free', 'team', 'business', 'enterprise'])

/** One per workspace once it has touched billing. Written only by the server (Stripe webhooks, checkout). */
export const workspaceBilling = pgTable('workspace_billing', {
  workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  plan: billingPlan('plan').notNull().default('free'),
  /** Stripe subscription status ('none' before any subscription). */
  status: text('status').notNull().default('none'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeItemId: text('stripe_item_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialUsed: boolean('trial_used').notNull().default(false),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  seats: integer('seats').notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('workspace_billing_customer_key').on(t.stripeCustomerId),
])

/** AI calls per workspace per UTC month, counted atomically against the plan's allowance. */
export const aiUsage = pgTable('ai_usage', {
  workspaceId: workspaceId(),
  month: text('month').notNull(),
  calls: integer('calls').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.month] }),
  check('ai_usage_month', sql`${t.month} ~ '^[0-9]{4}-[0-9]{2}$'`),
])

/** Who counted as an active contributor in a month: assigned work, or changed a task. Kept by trigger. */
export const contributorActivity = pgTable('contributor_activity', {
  workspaceId: workspaceId(),
  month: text('month').notNull(),
  memberId: uuid('member_id').notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.month, t.memberId] }),
])
