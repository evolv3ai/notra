CREATE TABLE "geo_traffic_embeds" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"created_by_user_id" text,
	"name" text NOT NULL,
	"host" text,
	"allowed_origins" text[] NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "geo_traffic_embeds" ADD CONSTRAINT "geo_traffic_embeds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_traffic_embeds" ADD CONSTRAINT "geo_traffic_embeds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_traffic_embeds" ADD CONSTRAINT "geo_traffic_embeds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geoTrafficEmbeds_organizationId_idx" ON "geo_traffic_embeds" USING btree ("organization_id");
