CREATE TABLE "chat_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_by_user_id" text,
	"title" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_chat_id_chat_sessions_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chatShares_organizationId_chatId_idx" ON "chat_shares" USING btree ("organization_id","chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatShares_active_chatId_uidx" ON "chat_shares" USING btree ("chat_id") WHERE "chat_shares"."revoked_at" IS NULL;