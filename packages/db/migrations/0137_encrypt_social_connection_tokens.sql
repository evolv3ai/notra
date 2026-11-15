-- Expand only: keep legacy values usable while older releases still serve.
-- Clear plaintext only after the compatible reader is live everywhere.
ALTER TABLE "social_connections" ADD COLUMN "encrypted_access_token" text;--> statement-breakpoint
-- No release reads stored refresh tokens, so clearing them is rollback-safe.
UPDATE "social_connections" SET "refresh_token" = NULL WHERE "refresh_token" IS NOT NULL;
