CREATE TABLE "slack_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text NOT NULL,
	"bot_user_id" text NOT NULL,
	"bot_token_sealed" text NOT NULL,
	"channel_id" text,
	"channel_name" text,
	"connected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slack_installations_team_key" ON "slack_installations" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_installations_workspace_key" ON "slack_installations" USING btree ("workspace_id");