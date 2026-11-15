CREATE TABLE "autopilot_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" text,
	"kind" text NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"repository" text,
	"pull_request_number" integer,
	"pull_request_url" text,
	"branch" text,
	"head_sha" text,
	"post_id" text,
	"error_message" text,
	"claim_token" text,
	"claimed_at" timestamp,
	"merged_at" timestamp,
	"dismissed_at" timestamp,
	"opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_run_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" text NOT NULL,
	"job" text,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT 'null'::jsonb,
	"internal" boolean DEFAULT false NOT NULL,
	"detail" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb DEFAULT 'null'::jsonb,
	"slack_message_ts" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"heartbeat_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopilot_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"project_id" text,
	"repository_owner" text,
	"repository_name" text,
	"repository_branch" text,
	"content_path" text,
	"slack_integration_id" text,
	"slack_channel_id" text,
	"slack_channel_name" text,
	"brief_hour" integer DEFAULT 9 NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"jobs" jsonb DEFAULT '{"readiness":true,"keywords":true,"commits":true,"competitors":true}'::jsonb NOT NULL,
	"max_open_pull_requests" integer DEFAULT 3 NOT NULL,
	"stale_pull_request_days" integer DEFAULT 14,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "geoPromptSuggestions_projectId_prompt_uidx";--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "action" text DEFAULT 'track' NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "target_prompt_id" text;--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "reason_data" jsonb;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ADD CONSTRAINT "autopilot_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ADD CONSTRAINT "autopilot_findings_run_id_autopilot_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."autopilot_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ADD CONSTRAINT "autopilot_findings_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_rules" ADD CONSTRAINT "autopilot_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_run_events" ADD CONSTRAINT "autopilot_run_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_run_events" ADD CONSTRAINT "autopilot_run_events_run_id_autopilot_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."autopilot_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ADD CONSTRAINT "autopilot_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD CONSTRAINT "autopilot_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD CONSTRAINT "autopilot_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_settings" ADD CONSTRAINT "autopilot_settings_slack_integration_id_slack_integrations_id_fk" FOREIGN KEY ("slack_integration_id") REFERENCES "public"."slack_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "autopilotFindings_organizationId_fingerprint_uidx" ON "autopilot_findings" USING btree ("organization_id","fingerprint");--> statement-breakpoint
CREATE INDEX "autopilotFindings_organizationId_status_idx" ON "autopilot_findings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "autopilotRules_organizationId_createdAt_idx" ON "autopilot_rules" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "autopilotRunEvents_runId_createdAt_idx" ON "autopilot_run_events" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "autopilotRuns_organizationId_startedAt_idx" ON "autopilot_runs" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "autopilotRuns_organizationId_running_uidx" ON "autopilot_runs" USING btree ("organization_id") WHERE "autopilot_runs"."status" = 'running' AND "autopilot_runs"."trigger" IN ('manual', 'cron', 'onboarding');--> statement-breakpoint
CREATE UNIQUE INDEX "geoPromptSuggestions_projectId_source_action_prompt_uidx" ON "geo_prompt_suggestions" USING btree ("project_id","source","action","prompt");