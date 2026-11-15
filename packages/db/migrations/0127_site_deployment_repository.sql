ALTER TABLE "site_deployments" ADD COLUMN "github_repository_id" text;--> statement-breakpoint
ALTER TABLE "site_deployments" ADD COLUMN "repository_owner" text;--> statement-breakpoint
ALTER TABLE "site_deployments" ADD COLUMN "repository_name" text;--> statement-breakpoint
UPDATE "site_deployments" AS "deployment" SET "github_repository_id" = "site"."github_repository_id", "repository_owner" = "site"."repository_owner", "repository_name" = "site"."repository_name" FROM "sites" AS "site" WHERE "site"."id" = "deployment"."site_id";
