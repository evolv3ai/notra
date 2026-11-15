"use client";

import {
  ArrowUpRight01Icon,
  Github01Icon,
  Search01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { SadCapybara } from "@/components/sad-capybara";
import {
  SITE_IMPORT_SCROLL_END_TOLERANCE_PX,
  SITE_IMPORT_SKELETON_KEYS,
} from "@/constants/site-create";
import { startGitHubInstall } from "@/lib/integrations/github/install";
import { cn } from "@/lib/utils";
import type { SiteImportListProps } from "@/types/components/sites";

function githubAvatarUrl(owner: string) {
  return `https://github.com/${encodeURIComponent(owner)}.png?size=64`;
}

function OwnerAvatar({
  owner,
  className,
}: {
  owner: string;
  className: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage alt="" src={githubAvatarUrl(owner)} />
      <AvatarFallback>{owner.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

export function SiteImportList({
  organizationId,
  organizationSlug,
  repositories,
  installed,
  isLoading,
  loadFailed,
  onRetry,
  importingId,
  onImport,
  callbackPath,
  actionLabel,
  actionAriaLabel,
  currentRepository = null,
}: SiteImportListProps) {
  const t = useTranslations("sites.new");
  const tSettings = useTranslations("sites.settings");
  const isCurrent = (repository: { owner: string; repo: string }) =>
    currentRepository !== null &&
    repository.owner.toLowerCase() === currentRepository.owner.toLowerCase() &&
    repository.repo.toLowerCase() === currentRepository.name.toLowerCase();
  const owners = [
    ...new Set(repositories.map((repository) => repository.owner)),
  ];
  const [owner, setOwner] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState(false);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const activeOwner = owner ?? owners[0] ?? null;
  const query = search.trim().toLowerCase();
  const visible = repositories
    .toSorted(
      (a, b) =>
        Number(isCurrent(b)) - Number(isCurrent(a)) ||
        Number(b.integrationId !== null) - Number(a.integrationId !== null) ||
        a.repo.localeCompare(b.repo)
    )
    .filter(
      (repository) =>
        (!activeOwner || repository.owner === activeOwner) &&
        repository.repo.toLowerCase().includes(query)
    );

  const updateFade = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    setHasMoreBelow(
      list.scrollHeight - list.scrollTop - list.clientHeight >
        SITE_IMPORT_SCROLL_END_TOLERANCE_PX
    );
  }, []);

  useEffect(() => {
    updateFade();
  }, [updateFade, visible.length, isLoading]);

  const install = async () => {
    setInstalling(true);
    const result = await startGitHubInstall({
      organizationId,
      callbackPath: callbackPath ?? `/${organizationSlug}/sites/new`,
    });
    if (!result.started) {
      setInstalling(false);
      toast.error(
        result.reason === "install-start-failed" && result.message
          ? result.message
          : t("installFailed")
      );
    }
  };

  if (loadFailed && !installed) {
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} variant="secondary">
            {t("repositoriesRetry")}
          </Button>
        }
        className="min-h-0 py-12"
        description={t("repositoriesLoadFailedDescription")}
        illustration={<SadCapybara />}
        title={t("repositoriesLoadFailedTitle")}
      />
    );
  }

  if (!(isLoading || installed)) {
    return (
      <EmptyState
        action={
          <Button loading={installing} onClick={install}>
            <HugeiconsIcon data-icon="inline-start" icon={Github01Icon} />
            {t("installGitHub")}
          </Button>
        }
        className="min-h-0 py-12"
        description={t("installDescription")}
        title={t("installTitle")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {owners.length > 1 ? (
          <Select
            onValueChange={(value: string | null) => setOwner(value)}
            value={activeOwner}
          >
            <SelectTrigger aria-label={t("account")} className="w-48 shrink-0">
              <SelectValue>
                {(value: string | null) =>
                  value ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <OwnerAvatar className="size-5" owner={value} />
                      <span className="truncate">{value}</span>
                    </span>
                  ) : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {owners.map((name) => (
                <SelectItem key={name} value={name}>
                  <span className="flex items-center gap-2">
                    <OwnerAvatar className="size-5" owner={name} />
                    {name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {owners.length <= 1 && activeOwner ? (
          <span className="bg-muted/30 flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-sm">
            <OwnerAvatar className="size-5" owner={activeOwner} />
            <span className="max-w-32 truncate">{activeOwner}</span>
          </span>
        ) : null}
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Search01Icon}
              size={14}
              strokeWidth={1.5}
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("searchRepositories")}
            autoCapitalize="none"
            autoComplete="off"
            disabled={isLoading}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchRepositories")}
            spellCheck={false}
            type="search"
            value={search}
          />
        </InputGroup>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <ul
          className={cn(
            "max-h-[22.5rem] divide-y overflow-y-auto overscroll-contain",
            hasMoreBelow &&
              "mask-[linear-gradient(to_bottom,black_calc(100%-4rem),transparent_100%)]"
          )}
          onScroll={updateFade}
          ref={listRef}
        >
          {isLoading
            ? SITE_IMPORT_SKELETON_KEYS.map((key) => (
                <li className="flex h-14 items-center gap-3 px-3" key={key}>
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3.5 w-48 rounded-sm" />
                </li>
              ))
            : visible.map((repository) => {
                const isImporting =
                  repository.githubRepositoryId === importingId;
                return (
                  <li
                    className="flex h-14 items-center gap-3 px-3"
                    key={repository.githubRepositoryId}
                  >
                    <OwnerAvatar
                      className="size-8 shrink-0"
                      owner={repository.owner}
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate text-sm">
                        <span className="text-muted-foreground">
                          {repository.owner}/
                        </span>
                        <span className="font-medium">{repository.repo}</span>
                      </span>
                      {repository.private ? (
                        <HugeiconsIcon
                          aria-label={t("private")}
                          className="text-muted-foreground shrink-0"
                          icon={SquareLock02Icon}
                          role="img"
                          size={12}
                        />
                      ) : null}
                    </span>
                    {isCurrent(repository) ? (
                      <Badge variant="secondary">
                        {tSettings("currentRepository")}
                      </Badge>
                    ) : (
                      <Button
                        aria-label={
                          actionAriaLabel?.(repository.repo) ??
                          t("importRepository", {
                            repository: repository.repo,
                          })
                        }
                        disabled={importingId !== null && !isImporting}
                        loading={isImporting}
                        onClick={() => onImport(repository)}
                        size="sm"
                      >
                        {actionLabel ?? t("import")}
                      </Button>
                    )}
                  </li>
                );
              })}
          {!isLoading && visible.length === 0 ? (
            <li className="text-muted-foreground px-3 py-8 text-center text-sm">
              {t("noRepositoryMatch")}
            </li>
          ) : null}
        </ul>
      </div>
      <Button
        loading={installing}
        onClick={install}
        type="button"
        size="sm"
        variant="link"
      >
        {t("adjustAccess")}
        <HugeiconsIcon aria-hidden="true" icon={ArrowUpRight01Icon} size={13} />
      </Button>
    </div>
  );
}
