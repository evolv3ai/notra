-- Keep publish_mode and the legacy site/path unique index while the previous deployment serves traffic.
-- Deployment drafts stay in site_drafts; feature drafts use a separate table so both app versions can write.
ALTER TABLE "site_drafts" ADD COLUMN IF NOT EXISTS "branch" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "site_drafts" SET "branch" = "sites"."production_branch" FROM "sites" WHERE "site_drafts"."site_id" = "sites"."id";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION site_draft_deployment_branch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch = '' THEN
    SELECT production_branch INTO NEW.branch FROM sites WHERE id = NEW.site_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS site_draft_deployment_branch ON site_drafts;
--> statement-breakpoint
CREATE TRIGGER site_draft_deployment_branch BEFORE INSERT ON site_drafts FOR EACH ROW EXECUTE FUNCTION site_draft_deployment_branch();
--> statement-breakpoint
ALTER TABLE "site_drafts" ADD COLUMN IF NOT EXISTS "committed_revision" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "siteDrafts_site_branch_path_uidx" ON "site_drafts" USING btree ("site_id","branch","path");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_branch_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "site_id" text NOT NULL CONSTRAINT "site_branch_drafts_site_id_sites_id_fk" REFERENCES "sites"("id") ON DELETE CASCADE,
  "branch" text NOT NULL,
  "path" text NOT NULL,
  "content" text NOT NULL,
  "base_blob_sha" text,
  "base_commit_sha" text,
  "deleted" boolean DEFAULT false NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "committed_revision" integer,
  "updated_by_user_id" text CONSTRAINT "site_branch_drafts_updated_by_user_id_users_id_fk" REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "siteBranchDrafts_site_branch_path_uidx" ON "site_branch_drafts" USING btree ("site_id","branch","path");
-- sites.publish_mode is deliberately dropped in a follow-up migration.
