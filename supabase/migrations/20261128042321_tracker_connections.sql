CREATE TYPE "public"."tracker_kind" AS ENUM('linear', 'jira');--> statement-breakpoint
CREATE TABLE "tracker_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "tracker_kind" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"site_url" text NOT NULL,
	"access_token_sealed" text NOT NULL,
	"refresh_token_sealed" text,
	"expires_at" timestamp with time zone,
	"write_back" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracker_connections" ADD CONSTRAINT "tracker_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_connections" ADD CONSTRAINT "tracker_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracker_connections_external_key" ON "tracker_connections" USING btree ("kind","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracker_connections_workspace_key" ON "tracker_connections" USING btree ("workspace_id","kind");