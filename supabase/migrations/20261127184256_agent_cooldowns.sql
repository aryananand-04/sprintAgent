CREATE TABLE "agent_cooldowns" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_cooldowns_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "agent_cooldowns" ADD CONSTRAINT "agent_cooldowns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;