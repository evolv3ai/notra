-- Every stored token has an encrypted copy, and releases since 0137 fall back
-- to it, so clearing plaintext is safe for the running app. Rows without an
-- encrypted copy keep theirs. A later migration drops both columns.
UPDATE "social_connections" SET "access_token" = NULL, "refresh_token" = NULL
WHERE "encrypted_access_token" IS NOT NULL
  AND ("access_token" IS NOT NULL OR "refresh_token" IS NOT NULL);
