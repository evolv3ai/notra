CREATE TABLE "post_versions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"post_id" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"source" text NOT NULL,
	"retained" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"markdown" text,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "post_versions_source_check" CHECK ("post_versions"."source" IN ('baseline', 'editor_autosave', 'editor_save', 'checkpoint', 'restore', 'ai', 'api', 'system')),
	CONSTRAINT "post_versions_revision_check" CHECK ("post_versions"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "discussion_comments" DROP CONSTRAINT "discussionComments_target_check";--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "content_id" text;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_org_post_fk" FOREIGN KEY ("organization_id","post_id") REFERENCES "public"."posts"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_versions_org_post_revision_uidx" ON "post_versions" USING btree ("organization_id","post_id","revision");--> statement-breakpoint
CREATE INDEX "post_versions_org_post_unretained_created_at_idx" ON "post_versions" USING btree ("organization_id","post_id","created_at") WHERE "post_versions"."retained" = false;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_content_id_posts_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discussionComments_content_idx" ON "discussion_comments" USING btree ("content_id","created_at");--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussionComments_resolution_check" CHECK (("discussion_comments"."resolved_at" IS NULL AND "discussion_comments"."resolved_by_user_id" IS NULL) OR ("discussion_comments"."resolved_at" IS NOT NULL AND "discussion_comments"."content_id" IS NOT NULL AND "discussion_comments"."parent_id" IS NULL));--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussionComments_target_check" CHECK (num_nonnulls("discussion_comments"."feedback_id", "discussion_comments"."shelf_source_id", "discussion_comments"."content_id") = 1);
--> statement-breakpoint
CREATE FUNCTION notra_capture_post_version(document posts, history_source text, actor_id text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE version_id text;
BEGIN
  IF document.content_type NOT IN ('blog_post', 'changelog') THEN
    RETURN NULL;
  END IF;
  INSERT INTO post_versions (organization_id, post_id, revision, actor_user_id, source, retained, title, slug, markdown, metadata)
  VALUES (document.organization_id, document.id, document.revision, actor_id, history_source,
    history_source = 'editor_save',
    document.title, document.slug, document.markdown,
    jsonb_build_object('contentType', document.content_type, 'contentSubtype', document.content_subtype,
      'recommendations', document.recommendations, 'coverImage', document.cover_image,
      'tags', document.tags, 'excerpt', document.excerpt, 'authorIds', document.author_ids,
      'featured', document.featured, 'noindex', document.noindex,
      'displayDate', to_char(document.display_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  ON CONFLICT (organization_id, post_id, revision) DO UPDATE SET retained = true
  WHERE history_source = 'editor_save' AND post_versions.retained = false
  RETURNING id INTO version_id;
  IF version_id IS NULL THEN
    SELECT id INTO version_id FROM post_versions
    WHERE organization_id = document.organization_id AND post_id = document.id AND revision = document.revision;
  END IF;
  RETURN version_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION notra_prune_post_history(tenant_id text, document_id text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT id FROM post_versions
    WHERE organization_id = tenant_id AND post_id = document_id
      AND retained = false
      AND created_at < now() - interval '90 days'
      AND revision < (SELECT max(revision) FROM post_versions WHERE organization_id = tenant_id AND post_id = document_id)
    ORDER BY created_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM post_versions WHERE id IN (SELECT id FROM candidates);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION notra_post_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.revision := 0;
    RETURN NEW;
  END IF;
  IF current_setting('notra.history_source', true) = 'restore' OR
    ROW(NEW.title, NEW.slug, NEW.markdown, NEW.content_type, NEW.content_subtype,
      NEW.recommendations, NEW.cover_image, NEW.tags, NEW.excerpt, NEW.author_ids,
      NEW.featured, NEW.noindex, NEW.display_date,
      CASE WHEN NEW.markdown IS NULL OR NEW.content_type NOT IN ('blog_post', 'changelog') THEN NEW.content END)
    IS DISTINCT FROM
    ROW(OLD.title, OLD.slug, OLD.markdown, OLD.content_type, OLD.content_subtype,
      OLD.recommendations, OLD.cover_image, OLD.tags, OLD.excerpt, OLD.author_ids,
      OLD.featured, OLD.noindex, OLD.display_date,
      CASE WHEN OLD.markdown IS NULL OR OLD.content_type NOT IN ('blog_post', 'changelog') THEN OLD.content END)
  THEN
    IF NOT EXISTS (SELECT 1 FROM post_versions WHERE organization_id = OLD.organization_id AND post_id = OLD.id) THEN
      PERFORM notra_capture_post_version(OLD, 'baseline', NULL);
    ELSIF current_setting('notra.history_source', true) IS DISTINCT FROM 'editor_autosave' THEN
      PERFORM notra_capture_post_version(OLD, 'checkpoint', NULL);
    END IF;
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER posts_revision BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION notra_post_revision();
--> statement-breakpoint
CREATE FUNCTION notra_post_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  history_source text := nullif(current_setting('notra.history_source', true), '');
  actor_id text := nullif(current_setting('notra.history_actor', true), '');
BEGIN
  IF NEW.content_type NOT IN ('blog_post', 'changelog') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF history_source IS NOT NULL AND history_source IN ('baseline', 'editor_autosave', 'editor_save', 'checkpoint', 'restore', 'ai', 'api', 'system') THEN
      PERFORM notra_capture_post_version(NEW, history_source, actor_id);
    ELSE
      PERFORM notra_capture_post_version(NEW, 'baseline', NULL);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.revision = OLD.revision THEN
    RETURN NEW;
  END IF;
  IF history_source IS NULL OR history_source NOT IN ('editor_autosave', 'editor_save', 'checkpoint', 'restore', 'ai', 'api', 'system') THEN
    history_source := 'system';
    actor_id := NULL;
  END IF;
  IF history_source <> 'editor_autosave' OR coalesce((
    SELECT created_at FROM post_versions
    WHERE organization_id = NEW.organization_id AND post_id = NEW.id
    ORDER BY revision DESC LIMIT 1
  ) < now() - interval '60 seconds', true) THEN
    PERFORM notra_capture_post_version(NEW, history_source, actor_id);
    PERFORM notra_prune_post_history(NEW.organization_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER posts_history AFTER INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION notra_post_history();
--> statement-breakpoint
SELECT notra_capture_post_version(posts, 'baseline', NULL) FROM posts
WHERE content_type IN ('blog_post', 'changelog');
--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "anchor" jsonb;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussionComments_anchor_check" CHECK ("discussion_comments"."anchor" IS NULL OR ("discussion_comments"."content_id" IS NOT NULL AND "discussion_comments"."parent_id" IS NULL AND "discussion_comments"."depth" = 0 AND jsonb_typeof("discussion_comments"."anchor") = 'object'));
