-- Drizzle runs migrations in a transaction. Lock both tables so preflight,
-- backfill and constraints observe one stable set of Sites and projects.
LOCK TABLE "sites", "projects" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
DECLARE
  unresolved text;
BEGIN
  SELECT string_agg(format('%s (org=%s, non-sample projects=%s)', s.id,
    s.organization_id, candidates.total), ', ' ORDER BY s.id)
  INTO unresolved
  FROM "sites" s
  CROSS JOIN LATERAL (
    SELECT count(*) AS total FROM "projects" p
    WHERE p.organization_id = s.organization_id AND p.is_sample = false
  ) candidates
  WHERE s.project_id IS NULL AND candidates.total <> 1;

  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'Sites require explicit project assignment: %', unresolved
      USING HINT = 'Assign each listed Site to a project in the same organization, then retry migration 0115. See packages/sites-server/README.md for preflight and assignment SQL.';
  END IF;

  UPDATE "sites" s SET project_id = p.id
  FROM "projects" p
  WHERE s.project_id IS NULL AND p.organization_id = s.organization_id
    AND p.is_sample = false;
END $$;
--> statement-breakpoint
ALTER TABLE "sites" DROP CONSTRAINT "sites_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sites_org_project_idx" ON "sites" USING btree ("organization_id","project_id");
