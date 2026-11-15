"use client";

import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CONTENT_AUTHOR_BIO_MAX_LENGTH,
  CONTENT_AUTHOR_SLUG_MAX_LENGTH,
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
} from "@notra/schemas/constants/dashboard/post-metadata";
import {
  type ContentAuthor,
  contentAuthorFieldsSchema,
} from "@notra/schemas/shared/post-metadata";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import { useContentAuthors } from "@/lib/hooks/use-content-authors";
import { uploadContentMedia } from "@/lib/upload/client";
import type {
  ContentAuthorDraft,
  ContentAuthorFormProps,
  ContentAuthorsDialogProps,
} from "@/types/content/overview";
import { authorSlugBase } from "@/utils/content-authors";
import { toErrorMessage } from "@/utils/error-message";

function toDraft(author: ContentAuthor | null): ContentAuthorDraft {
  return {
    name: author?.name ?? "",
    slug: author?.slug ?? "",
    title: author?.title ?? "",
    bio: author?.bio ?? "",
    avatarUrl: author?.avatarUrl ?? null,
    url: author?.url ?? "",
    x: author?.x ?? "",
    linkedin: author?.linkedin ?? "",
    github: author?.github ?? "",
  };
}

function AuthorForm({
  organizationId,
  author,
  onDone,
}: ContentAuthorFormProps) {
  const t = useTranslations("content.overview.authorDialog");
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { create, update } = useContentAuthors(organizationId);
  const [draft, setDraft] = useState(() => toDraft(author));
  const slugEdited = useRef(Boolean(author));
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<ContentAuthorDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    const parsed = contentAuthorFieldsSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("saveFailed"));
      return;
    }
    try {
      if (author) {
        await update.mutateAsync({
          organizationId,
          authorId: author.id,
          author: parsed.data,
        });
      } else {
        await create.mutateAsync({ organizationId, author: parsed.data });
      }
      toast.success(t("saved"));
      onDone();
    } catch (error) {
      toast.error(toErrorMessage(error, t("saveFailed")));
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadContentMedia(file, "image", t("saveFailed"));
      set({ avatarUrl: url });
    } catch (error) {
      toast.error(toErrorMessage(error, t("saveFailed")));
    }
    setUploading(false);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-3">
        <ContentAuthorAvatar
          author={{ name: draft.name || "?", avatarUrl: draft.avatarUrl }}
          className="size-12"
        />
        <input
          accept="image/*"
          aria-label={t("uploadAvatar")}
          className="sr-only"
          onChange={(event) => {
            void uploadAvatar(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={fileRef}
          tabIndex={-1}
          type="file"
        />
        <Button
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("uploadAvatar")}
        </Button>
        {draft.avatarUrl ? (
          <Button
            onClick={() => set({ avatarUrl: null })}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("removeAvatar")}
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>{t("name")}</Label>
          <Input
            autoFocus
            id={`${id}-name`}
            maxLength={CONTENT_AUTHOR_NAME_MAX_LENGTH}
            onChange={(event) => {
              const name = event.target.value;
              set(
                slugEdited.current
                  ? { name }
                  : { name, slug: authorSlugBase(name) }
              );
            }}
            required
            value={draft.name}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>{t("role")}</Label>
          <Input
            id={`${id}-title`}
            maxLength={CONTENT_AUTHOR_TITLE_MAX_LENGTH}
            onChange={(event) => set({ title: event.target.value })}
            value={draft.title}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-slug`}>{t("slug")}</Label>
        <Input
          className="font-mono text-xs"
          id={`${id}-slug`}
          maxLength={CONTENT_AUTHOR_SLUG_MAX_LENGTH}
          onChange={(event) => {
            slugEdited.current = true;
            set({ slug: event.target.value.toLowerCase() });
          }}
          required
          value={draft.slug}
        />
        <p className="text-muted-foreground text-xs">
          {t("slugHint", { slug: draft.slug || "…" })}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-bio`}>{t("bio")}</Label>
        <Textarea
          className="min-h-16 resize-none"
          id={`${id}-bio`}
          maxLength={CONTENT_AUTHOR_BIO_MAX_LENGTH}
          onChange={(event) => set({ bio: event.target.value })}
          value={draft.bio}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {CONTENT_AUTHOR_LINK_FIELDS.map((field) => (
          <div className="space-y-1.5" key={field}>
            <Label htmlFor={`${id}-${field}`}>
              {t(field === "url" ? "website" : field)}
            </Label>
            <Input
              id={`${id}-${field}`}
              inputMode="url"
              onChange={(event) => set({ [field]: event.target.value })}
              placeholder="https://"
              value={draft[field]}
            />
          </div>
        ))}
      </div>
      <ResponsiveDialogFooter>
        <Button onClick={onDone} type="button" variant="ghost">
          {t("back")}
        </Button>
        <Button
          data-dialog-confirm
          disabled={pending || uploading}
          type="submit"
        >
          {t("save")}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

export function ContentAuthorsDialog({
  organizationId,
  open,
  onOpenChange,
}: ContentAuthorsDialogProps) {
  const t = useTranslations("content.overview.authorDialog");
  const { authors, currentUserId, remove } = useContentAuthors(organizationId);
  const [editing, setEditing] = useState<ContentAuthor | "new" | null>(null);

  const deleteAuthor = async (author: ContentAuthor) => {
    try {
      await remove.mutateAsync({ organizationId, authorId: author.id });
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(toErrorMessage(error, t("saveFailed")));
    }
  };

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEditing(null);
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editing === "new" ? t("new") : editing ? editing.name : t("title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {editing ? (
          <AuthorForm
            author={editing === "new" ? null : editing}
            key={editing === "new" ? "new" : editing.id}
            onDone={() => setEditing(null)}
            organizationId={organizationId}
          />
        ) : (
          <div className="space-y-3">
            {authors.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t("empty")}
              </p>
            ) : (
              <ul className="divide-border/60 -mx-1 divide-y">
                {authors.map((author) => (
                  <li
                    className="flex items-center gap-3 px-1 py-2"
                    key={author.id}
                  >
                    <ContentAuthorAvatar author={author} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {author.name}
                        {author.userId === currentUserId ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {t("you")}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {author.title || `/author/${author.slug}`}
                      </p>
                    </div>
                    <Button
                      aria-label={t("edit")}
                      onClick={() => setEditing(author)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        strokeWidth={1.8}
                      />
                    </Button>
                    <ConfirmDialog
                      confirmLabel={t("delete")}
                      onConfirm={() => deleteAuthor(author)}
                      title={t("deleteConfirm", { name: author.name })}
                      trigger={
                        <Button
                          aria-label={t("delete")}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            strokeWidth={1.8}
                          />
                        </Button>
                      }
                      variant="destructive"
                    />
                  </li>
                ))}
              </ul>
            )}
            <ResponsiveDialogFooter>
              <Button onClick={() => setEditing("new")}>{t("new")}</Button>
            </ResponsiveDialogFooter>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
