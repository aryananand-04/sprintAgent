CREATE TYPE "public"."licensed_action" AS ENUM('assign', 'rebalance');--> statement-breakpoint
CREATE TYPE "public"."prediction_mode" AS ENUM('shadow', 'acted');--> statement-breakpoint
CREATE TYPE "public"."prediction_outcome" AS ENUM('agree', 'disagree', 'expired');--> statement-breakpoint
ALTER TYPE "public"."decision_kind" ADD VALUE 'license';--> statement-breakpoint
CREATE TABLE "autonomy_licenses" (
	"workspace_id" uuid NOT NULL,
	"task_type" "task_type" NOT NULL,
	"action" "licensed_action" NOT NULL,
	"earned_level" smallint DEFAULT 1 NOT NULL,
	"cap" smallint DEFAULT 3 NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	"agree" integer DEFAULT 0 NOT NULL,
	"lower_bound" real DEFAULT 0 NOT NULL,
	"reason" text DEFAULT 'No evidence yet: the agent is still watching.' NOT NULL,
	"changed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "autonomy_licenses_workspace_id_task_type_action_pk" PRIMARY KEY("workspace_id","task_type","action"),
	CONSTRAINT "licenses_levels" CHECK ("autonomy_licenses"."earned_level" between 0 and 3 and "autonomy_licenses"."cap" between 0 and 3),
	CONSTRAINT "licenses_counts" CHECK ("autonomy_licenses"."agree" between 0 and "autonomy_licenses"."n")
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"task_type" "task_type" NOT NULL,
	"action" "licensed_action" NOT NULL,
	"mode" "prediction_mode" NOT NULL,
	"predicted_member_id" uuid,
	"previous_member_id" uuid,
	"confidence" smallint,
	"rationale" text NOT NULL,
	"undo_until" timestamp with time zone,
	"outcome" "prediction_outcome",
	"actual_member_id" uuid,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "actor_ref" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "chain_index" bigint;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "prev_hash" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "hash" text;--> statement-breakpoint
ALTER TABLE "autonomy_licenses" ADD CONSTRAINT "autonomy_licenses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_predicted_member_id_team_members_id_fk" FOREIGN KEY ("predicted_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_previous_member_id_team_members_id_fk" FOREIGN KEY ("previous_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_actual_member_id_team_members_id_fk" FOREIGN KEY ("actual_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "predictions_ws_resolved_idx" ON "predictions" USING btree ("workspace_id","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_open_key" ON "predictions" USING btree ("task_id","action") WHERE "predictions"."outcome" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_chain_key" ON "decisions" USING btree ("workspace_id","chain_index");