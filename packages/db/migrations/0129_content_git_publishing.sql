-- Additive default keeps existing output writers and the previous deployment compatible.
ALTER TABLE "repository_outputs" ADD COLUMN IF NOT EXISTS "review_process" text DEFAULT 'pull_request' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repositoryOutputs_reviewProcess_check' AND conrelid = 'repository_outputs'::regclass) THEN
    ALTER TABLE "repository_outputs" ADD CONSTRAINT "repositoryOutputs_reviewProcess_check" CHECK ("review_process" IN ('pull_request', 'direct'));
  END IF;
END $$;

--> statement-breakpoint
-- Direct commits use the existing terminal merged status; old PR writers remain valid.
ALTER TABLE "content_publications" ALTER COLUMN "pull_request_number" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "content_publications" ALTER COLUMN "pull_request_url" DROP NOT NULL;
