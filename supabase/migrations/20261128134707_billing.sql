CREATE TYPE "public"."billing_plan" AS ENUM('free', 'team', 'business', 'enterprise');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"workspace_id" uuid NOT NULL,
	"month" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_workspace_id_month_pk" PRIMARY KEY("workspace_id","month"),
	CONSTRAINT "ai_usage_month" CHECK ("ai_usage"."month" ~ '^[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "contributor_activity" (
	"workspace_id" uuid NOT NULL,
	"month" text NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "contributor_activity_workspace_id_month_member_id_pk" PRIMARY KEY("workspace_id","month","member_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_billing" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"plan" "billing_plan" DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_item_id" text,
	"current_period_end" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"trial_used" boolean DEFAULT false NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"seats" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_activity" ADD CONSTRAINT "contributor_activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_activity" ADD CONSTRAINT "contributor_activity_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_customer_key" ON "workspace_billing" USING btree ("stripe_customer_id");