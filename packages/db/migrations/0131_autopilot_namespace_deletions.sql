CREATE TABLE "autopilot_namespace_deletions" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "autopilotNamespaceDeletions_nextAttemptAt_idx" ON "autopilot_namespace_deletions" USING btree ("next_attempt_at");
