CREATE TABLE "system_skill_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"system_skill_id" text NOT NULL,
	"version" integer NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"note" text,
	"published_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "system_skill_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "system_skill_version" integer;--> statement-breakpoint
ALTER TABLE "system_skill_versions" ADD CONSTRAINT "system_skill_versions_system_skill_id_system_skills_id_fk" FOREIGN KEY ("system_skill_id") REFERENCES "public"."system_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_skill_versions" ADD CONSTRAINT "system_skill_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "system_skill_versions_skill_version_uidx" ON "system_skill_versions" USING btree ("system_skill_id","version");--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_system_skill_id_system_skills_id_fk" FOREIGN KEY ("system_skill_id") REFERENCES "public"."system_skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skills_system_skill_idx" ON "skills" USING btree ("system_skill_id");