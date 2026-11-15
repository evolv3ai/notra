CREATE TABLE "abuse_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"action" text NOT NULL,
	"category" text,
	"reason" text,
	"retry" boolean DEFAULT false NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "abuse_actions_subjectType_check" CHECK ("abuse_actions"."subject_type" IN ('site', 'organization', 'user')),
	CONSTRAINT "abuse_actions_action_check" CHECK ("abuse_actions"."action" IN ('suspend', 'unsuspend', 'ban', 'unban')),
	CONSTRAINT "abuse_actions_category_check" CHECK ("abuse_actions"."category" IN ('phishing', 'malware', 'deceptive_redirects', 'spam', 'terms'))
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "suspended_category" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "suspended_with_organization" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_suspendedCategory_check" CHECK ("organizations"."suspended_category" IN ('phishing', 'malware', 'deceptive_redirects', 'spam', 'terms'));--> statement-breakpoint
ALTER TABLE "abuse_actions" ADD CONSTRAINT "abuse_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_actions_subject_idx" ON "abuse_actions" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "abuse_actions_createdAt_idx" ON "abuse_actions" USING btree ("created_at");
