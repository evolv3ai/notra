CREATE TABLE "workflow_run_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" text NOT NULL,
	"node_id" text NOT NULL,
	"status" text NOT NULL,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"port" text,
	"output" jsonb,
	"error_message" text,
	"reason" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workflow_key" text NOT NULL,
	"parent_run_id" text,
	"root_run_id" text,
	"parent_node_id" text,
	"graph" jsonb NOT NULL,
	"runtime_run_id" text,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"failed_node_id" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autopilot_runs" ADD COLUMN "workflow_key" text;--> statement-breakpoint
ALTER TABLE "workflow_run_nodes" ADD CONSTRAINT "workflow_run_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_nodes" ADD CONSTRAINT "workflow_run_nodes_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_parent_run_id_workflow_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflowRunNodes_runId_nodeId_uidx" ON "workflow_run_nodes" USING btree ("run_id","node_id");--> statement-breakpoint
CREATE INDEX "workflowRuns_organizationId_createdAt_idx" ON "workflow_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "workflowRuns_organizationId_workflowKey_createdAt_idx" ON "workflow_runs" USING btree ("organization_id","workflow_key","created_at");--> statement-breakpoint
CREATE INDEX "workflowRuns_rootRunId_idx" ON "workflow_runs" USING btree ("root_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflowRuns_parentRunId_parentNodeId_uidx" ON "workflow_runs" USING btree ("parent_run_id","parent_node_id");
