CREATE TABLE "brand_og_design_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"stage" text NOT NULL,
	"requested_model" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"usage" jsonb,
	"route" jsonb,
	"estimated_cost_usd" double precision,
	"reported_cost_usd" double precision,
	"cost_checked_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "brand_og_design_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_settings_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"lease_expires_at" timestamp NOT NULL,
	"retry_after" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "brand_og_templates" (
	"brand_settings_id" text PRIMARY KEY NOT NULL,
	"source_hash" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_og_design_calls" ADD CONSTRAINT "brand_og_design_calls_run_id_brand_og_design_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."brand_og_design_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_og_design_runs" ADD CONSTRAINT "brand_og_design_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_og_design_runs" ADD CONSTRAINT "brand_og_design_runs_brand_settings_id_brand_settings_id_fk" FOREIGN KEY ("brand_settings_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_og_templates" ADD CONSTRAINT "brand_og_templates_brand_settings_id_brand_settings_id_fk" FOREIGN KEY ("brand_settings_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brandOgDesignCalls_run_idx" ON "brand_og_design_calls" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brandOgDesignRuns_active_uidx" ON "brand_og_design_runs" USING btree ("brand_settings_id") WHERE "brand_og_design_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "brandOgDesignRuns_brand_hash_idx" ON "brand_og_design_runs" USING btree ("brand_settings_id","source_hash");
