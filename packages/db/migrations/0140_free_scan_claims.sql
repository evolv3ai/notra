CREATE TABLE "free_scan_claims" (
	"domain" text PRIMARY KEY NOT NULL,
	"prompt_limit" integer DEFAULT 15 NOT NULL,
	"organization_id" text,
	"claimed_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "free_scan_claims" ADD CONSTRAINT "free_scan_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freeScanClaims_organizationId_idx" ON "free_scan_claims" USING btree ("organization_id");
