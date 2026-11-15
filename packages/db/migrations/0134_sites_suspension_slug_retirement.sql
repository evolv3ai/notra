ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "suspended_by" text;--> statement-breakpoint
-- Staff could suspend without a reason, so existing suspensions are treated as Notra's; support can lift self-suspended ones.
UPDATE "sites" SET "suspended_by" = 'notra' WHERE "status" = 'suspended' AND "suspended_by" IS NULL;--> statement-breakpoint
ALTER TABLE "sites" DROP CONSTRAINT IF EXISTS "sites_suspendedBy_check";--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_suspendedBy_check" CHECK ("sites"."suspended_by" IN ('owner', 'notra'));--> statement-breakpoint
ALTER TABLE "site_slug_grants" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "site_slug_grants" DROP CONSTRAINT IF EXISTS "site_slug_grants_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "site_slug_grants" ADD CONSTRAINT "site_slug_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
