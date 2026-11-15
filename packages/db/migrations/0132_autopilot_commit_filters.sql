ALTER TABLE "autopilot_settings" ADD COLUMN IF NOT EXISTS "commit_filters" jsonb DEFAULT '{"excludedAuthors":["dependabot[bot]","renovate[bot]","github-actions[bot]"],"paths":{}}'::jsonb NOT NULL;
