CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"automation_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"title" text,
	"error_message" text,
	"post_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "automation_runs_status_check" CHECK ("automation_runs"."status" IN ('running', 'success', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_content_triggers_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."content_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automationRuns_org_startedAt_idx" ON "automation_runs" USING btree ("organization_id","started_at","id");--> statement-breakpoint
CREATE INDEX "automationRuns_org_automation_startedAt_idx" ON "automation_runs" USING btree ("organization_id","automation_id","started_at");