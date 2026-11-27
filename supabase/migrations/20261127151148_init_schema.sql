CREATE TYPE "public"."ad_hoc_resolution" AS ENUM('absorb', 'swap', 'escalate');--> statement-breakpoint
CREATE TYPE "public"."agent_decision" AS ENUM('ACT', 'ASK', 'ESCALATE');--> statement-breakpoint
CREATE TYPE "public"."decision_kind" AS ENUM('triage', 'assign', 'rebalance', 'escalate', 'ad-hoc', 'override');--> statement-breakpoint
CREATE TYPE "public"."decision_source" AS ENUM('ai', 'rules', 'human');--> statement-breakpoint
CREATE TYPE "public"."escalation_category" AS ENUM('missing-criteria', 'scope-conflict', 'blocker', 'capacity', 'ambiguous', 'stakeholder');--> statement-breakpoint
CREATE TYPE "public"."feed_type" AS ENUM('assign', 'escalate', 'triage', 'status', 'risk', 'adHoc', 'resolve', 'intake');--> statement-breakpoint
CREATE TYPE "public"."sprint_health" AS ENUM('green', 'yellow', 'red');--> statement-breakpoint
CREATE TYPE "public"."sprint_status" AS ENUM('planned', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'triaged', 'assigned', 'in-progress', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('bug', 'feature', 'spike', 'design', 'urgent', 'ad-hoc', 'chore');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('viewer', 'contributor', 'pm', 'admin');--> statement-breakpoint
CREATE TABLE "autonomy_policies" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"act_min_clarity" smallint DEFAULT 3 NOT NULL,
	"ask_max_clarity" smallint DEFAULT 2 NOT NULL,
	"escalate_if_critical_unassigned_hours" smallint DEFAULT 1 NOT NULL,
	"never_auto_assign_types" "task_type"[] DEFAULT '{}' NOT NULL,
	"capacity_breach_threshold" smallint DEFAULT 90 NOT NULL,
	"blocked_hours_threshold" smallint DEFAULT 2 NOT NULL,
	"esc_nudge_hours" smallint DEFAULT 4 NOT NULL,
	"velocity_deficit_pts" smallint DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "autonomy_clarity_order" CHECK ("autonomy_policies"."ask_max_clarity" < "autonomy_policies"."act_min_clarity" and "autonomy_policies"."act_min_clarity" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "calibration" (
	"workspace_id" uuid NOT NULL,
	"decision" "agent_decision" NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calibration_workspace_id_decision_pk" PRIMARY KEY("workspace_id","decision"),
	CONSTRAINT "calibration_counts" CHECK ("calibration"."correct" between 0 and "calibration"."total")
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid,
	"kind" "decision_kind" NOT NULL,
	"source" "decision_source" NOT NULL,
	"decision" "agent_decision",
	"rationale" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid,
	"task_title" text NOT NULL,
	"reason" text NOT NULL,
	"recommendation" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"category" "escalation_category" NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "feed_type" NOT NULL,
	"message" text NOT NULL,
	"task_id" uuid,
	"member_id" uuid,
	"decision" "agent_decision",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"status" "sprint_status" DEFAULT 'planned' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"committed_points" integer DEFAULT 0 NOT NULL,
	"completed_points" integer DEFAULT 0 NOT NULL,
	"velocity" integer DEFAULT 0 NOT NULL,
	"health" "sprint_health" DEFAULT 'green' NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprints_dates" CHECK ("sprints"."end_date" >= "sprints"."start_date")
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id"),
	CONSTRAINT "task_dependencies_no_self" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sprint_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "task_type" NOT NULL,
	"status" "task_status" DEFAULT 'backlog' NOT NULL,
	"urgency" "urgency" DEFAULT 'medium' NOT NULL,
	"impact" smallint NOT NULL,
	"effort" smallint NOT NULL,
	"risk" smallint NOT NULL,
	"clarity" smallint NOT NULL,
	"assignee_id" uuid,
	"external_blockers" text[] DEFAULT '{}' NOT NULL,
	"source" text DEFAULT 'PM' NOT NULL,
	"external_ref" text,
	"story_points" smallint,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"decision" "agent_decision",
	"decision_reason" text,
	"triage_score" smallint,
	"confidence" smallint,
	"is_ai_triaged" boolean DEFAULT false NOT NULL,
	"is_ad_hoc" boolean DEFAULT false NOT NULL,
	"ad_hoc_resolution" "ad_hoc_resolution",
	"ad_hoc_swapped_task_id" uuid,
	"goal_alignment" smallint,
	"acceptance_criteria" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_dims_range" CHECK ("tasks"."impact" between 1 and 5 and "tasks"."effort" between 1 and 5 and "tasks"."risk" between 1 and 5 and "tasks"."clarity" between 1 and 5),
	CONSTRAINT "tasks_score_range" CHECK ("tasks"."triage_score" is null or "tasks"."triage_score" between 0 and 100),
	CONSTRAINT "tasks_confidence_range" CHECK ("tasks"."confidence" is null or "tasks"."confidence" between 0 and 100),
	CONSTRAINT "tasks_goal_alignment_range" CHECK ("tasks"."goal_alignment" is null or "tasks"."goal_alignment" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"title" text NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"current_load" smallint DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_load_range" CHECK ("team_members"."current_load" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_format" CHECK ("workspaces"."slug" ~ '^[a-z0-9][a-z0-9-]{1,47}$')
);
--> statement-breakpoint
ALTER TABLE "autonomy_policies" ADD CONSTRAINT "autonomy_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autonomy_policies" ADD CONSTRAINT "autonomy_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration" ADD CONSTRAINT "calibration_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_team_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_ws_created_idx" ON "decisions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "escalations_ws_open_idx" ON "escalations" USING btree ("workspace_id") WHERE "escalations"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "feed_events_ws_created_idx" ON "feed_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "sprints_ws_idx" ON "sprints" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sprints_one_active_per_ws" ON "sprints" USING btree ("workspace_id") WHERE "sprints"."status" = 'active';--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "tasks_ws_status_idx" ON "tasks" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "tasks_sprint_idx" ON "tasks" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_ws_external_ref_key" ON "tasks" USING btree ("workspace_id","external_ref");--> statement-breakpoint
CREATE INDEX "team_members_ws_idx" ON "team_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_ws_user_key" ON "team_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces" USING btree ("slug");