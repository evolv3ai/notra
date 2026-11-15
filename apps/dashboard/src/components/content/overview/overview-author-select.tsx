"use client";

import { POST_AUTHORS_MAX } from "@notra/ai/constants/post-metadata";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@notra/ui/components/ui/select";
import { cn } from "@notra/ui/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { AUTHOR_AVATAR_STACK_MAX } from "@/constants/content-overview";
import { useContentAuthors } from "@/lib/hooks/use-content-authors";
import type {
  ContentAuthorAvatarProps,
  OverviewAuthorSelectProps,
} from "@/types/content/overview";
import { toErrorMessage } from "@/utils/error-message";

export function ContentAuthorAvatar({
  author,
  className,
}: ContentAuthorAvatarProps) {
  const initials = author.name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Avatar
      className={cn(
        "size-[18px] shrink-0 rounded-full after:rounded-full",
        className
      )}
    >
      {author.avatarUrl ? <AvatarImage alt="" src={author.avatarUrl} /> : null}
      <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function OverviewAuthorSelect({
  organizationId,
  authorIds,
  onChange,
}: OverviewAuthorSelectProps) {
  const t = useTranslations("content.overview.authors");
  const tSave = useTranslations("content.overview");
  const { authors, currentUserId, ensureSelf } =
    useContentAuthors(organizationId);
  const byId = new Map(authors.map((author) => [author.id, author]));
  const selected = authorIds
    .map((id) => byId.get(id))
    .filter((author): author is ContentAuthor => Boolean(author));
  const hasSelf = selected.some((author) => author.userId === currentUserId);

  const addMe = async () => {
    try {
      const { author } = await ensureSelf.mutateAsync({ organizationId });
      if (!authorIds.includes(author.id)) {
        onChange([...authorIds, author.id].slice(0, POST_AUTHORS_MAX));
      }
    } catch (error) {
      toast.error(toErrorMessage(error, tSave("saveFailed")));
    }
  };

  return (
    <div className="space-y-1.5">
      <Select
        multiple
        onValueChange={(value) =>
          onChange((value as string[]).slice(0, POST_AUTHORS_MAX))
        }
        value={authorIds}
      >
        <SelectTrigger aria-label={t("label")} className="w-full">
          {selected.length > 0 ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex shrink-0 -space-x-1.5">
                {selected.slice(0, AUTHOR_AVATAR_STACK_MAX).map((author) => (
                  <ContentAuthorAvatar
                    author={author}
                    className={cn(
                      selected.length > 1 && "ring-background ring-2"
                    )}
                    key={author.id}
                  />
                ))}
              </span>
              <span className="truncate">
                {selected.length > 2
                  ? `${selected[0]?.name}, +${selected.length - 1}`
                  : selected.map((author) => author.name).join(", ")}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t("placeholder")}</span>
          )}
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {authors.map((author) => (
            <SelectItem key={author.id} value={author.id}>
              <ContentAuthorAvatar author={author} />
              <span className="truncate">{author.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected.length === 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">{t("fallback")}</p>
          {hasSelf ? null : (
            <Button
              disabled={ensureSelf.isPending}
              onClick={() => {
                void addMe();
              }}
              size="xs"
              variant="ghost"
            >
              {t("addMe")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
