"use client";

import {
  Copy01Icon,
  Delete02Icon,
  LinkSquare02Icon,
  Rocket01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SITE_PREVIEW_PASSWORD_MAX_LENGTH,
  SITE_PREVIEW_PASSWORD_MIN_LENGTH,
} from "@notra/sites-core/constants/sites";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Collapsible,
  CollapsibleContent,
} from "@notra/ui/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
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
import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  OverviewField,
  OverviewToggleRow,
} from "@/components/content/overview/overview-field";
import {
  POST_PREVIEW_LIFETIME_OPTIONS,
  POST_PREVIEW_STATUS_BADGES,
} from "@/constants/sites";
import {
  usePostSitePreview,
  usePrefetchPostSitePreview,
} from "@/lib/hooks/use-post-site-preview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ContentSitePreviewProps,
  PostSitePreviewActionsProps,
  PostSitePreviewSectionProps,
} from "@/types/components/content-detail-toolbar";
import type { PostPreviewLifetime } from "@/types/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { toErrorMessage } from "@/utils/error-message";

function PreviewRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="text-foreground shrink-0 text-[13px] font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Keeps the real element in the layout while it loads, so swapping the
 * placeholder for content never moves anything.
 */
function LoadingMask({
  loading,
  className,
  skeletonClassName = "inset-0 rounded-lg",
  children,
}: {
  loading: boolean;
  className?: string;
  skeletonClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <div aria-hidden={loading} className={loading ? "invisible" : undefined}>
        {children}
      </div>
      {loading ? (
        <Skeleton className={`absolute ${skeletonClassName}`} />
      ) : null}
    </div>
  );
}

/** A value in the fixed right column, so its left edge never moves. */
function PreviewValue({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <LoadingMask
      className="w-44 shrink-0"
      loading={loading}
      skeletonClassName="top-1 bottom-1 left-0 w-24 rounded-md"
    >
      <div className="flex h-6 min-w-0 items-center">{children}</div>
    </LoadingMask>
  );
}

function PreviewSiteSelect({ model }: PostSitePreviewSectionProps) {
  const t = useTranslations("content.sitePreview");
  const { sites, site, setChosenSiteId } = model;
  if (sites.length < 2 || !site) {
    return null;
  }
  return (
    <PreviewRow label={t("site")}>
      <Select
        onValueChange={(next: string | null) => setChosenSiteId(next)}
        value={site.id}
      >
        <SelectTrigger aria-label={t("site")} className="w-44" size="sm">
          <SelectValue>
            {(current: string) =>
              sites.find((item) => item.id === current)?.name
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {sites.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PreviewRow>
  );
}

function PreviewLinks({ model }: PostSitePreviewSectionProps) {
  const t = useTranslations("content.sitePreview");
  const format = useFormatter();
  const { preview, live, scope, state } = model;
  const loading = model.loading || model.statusLoading;
  const shown = live && preview ? preview : null;
  const openPreview = async () => {
    if (!shown) {
      return;
    }
    // Opened inside the click so the browser doesn't block it.
    const popup = window.open("", "_blank");
    try {
      const { url } = await dashboardOrpc.sites.previews.accessUrl.call({
        organizationId: scope.organizationId,
        siteId: scope.siteId,
        previewKey: shown.previewKey,
        kind: "member",
        next: shown.pagePath,
      });
      if (popup) {
        popup.opener = null;
        popup.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      popup?.close();
      toast.error(toErrorMessage(error, t("openFailed")));
    }
  };
  const muted = "text-muted-foreground min-w-0 truncate text-xs";
  const failure =
    state === "failed" ? (preview?.errorMessage ?? t("failed")) : null;
  let access = "—";
  if (shown) {
    access = shown.hasPassword ? t("withPassword") : t("anyoneWithLink");
  }
  return (
    <>
      <PreviewRow label={t("link")}>
        <PreviewValue loading={loading}>
          <span
            className={
              failure
                ? "text-destructive min-w-0 truncate text-xs"
                : `${muted} ${shown ? "font-mono" : ""}`
            }
            title={failure ?? undefined}
          >
            {failure ?? (shown ? shown.url.replace(/^https?:\/\//, "") : "—")}
          </span>
        </PreviewValue>
      </PreviewRow>
      <PreviewRow label={t("expires")}>
        <PreviewValue loading={loading}>
          <span className={muted}>
            {shown ? format.relativeTime(new Date(shown.expiresAt)) : "—"}
          </span>
        </PreviewValue>
      </PreviewRow>
      <PreviewRow label={t("access")}>
        <PreviewValue loading={loading}>
          <span className={muted}>{access}</span>
        </PreviewValue>
      </PreviewRow>
      <LoadingMask className="pt-4" loading={loading}>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={!shown}
            onClick={() => {
              if (shown) {
                void copyTextToClipboard(shown.url, t("linkCopied"));
              }
            }}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon aria-hidden="true" icon={Copy01Icon} />
            {t("copyLink")}
          </Button>
          <Button
            disabled={!shown}
            onClick={() => {
              void openPreview();
            }}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon aria-hidden="true" icon={LinkSquare02Icon} />
            {t("open")}
          </Button>
        </div>
      </LoadingMask>
    </>
  );
}

function PreviewSummary({ model }: PostSitePreviewSectionProps) {
  const t = useTranslations("content.sitePreview");
  const { state } = model;
  return (
    <div className="space-y-1">
      <PreviewSiteSelect model={model} />
      <PreviewRow label={t("status")}>
        <PreviewValue loading={model.loading || model.statusLoading}>
          <StatusBadge
            appearance={POST_PREVIEW_STATUS_BADGES[state]}
            label={t(`states.${state}`)}
          />
        </PreviewValue>
      </PreviewRow>
      <PreviewLinks model={model} />
    </div>
  );
}

function PreviewAccessFields({ model }: PostSitePreviewSectionProps) {
  const t = useTranslations("content.sitePreview");
  const { preview, live, updateAccess, hasPassword, password } = model;
  const loading = model.loading || model.statusLoading;
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const tooShort = password.length > 0 && !model.passwordValid;
  const savingPassword =
    updateAccess.isPending &&
    updateAccess.variables !== undefined &&
    "password" in updateAccess.variables;
  return (
    <>
      <OverviewField hint={t("validForHint")} label={t("validFor")}>
        <LoadingMask loading={loading}>
          <Select
            disabled={loading || model.deleting || updateAccess.isPending}
            onValueChange={(next: PostPreviewLifetime | null) => {
              if (!next) {
                return;
              }
              model.setLifetime(next);
              if (live) {
                updateAccess.mutate({ lifetime: next });
              }
            }}
            value={model.lifetime}
          >
            <SelectTrigger
              aria-label={t("validFor")}
              className="w-full"
              size="sm"
            >
              <SelectValue>
                {(current: PostPreviewLifetime) => t(`lifetimes.${current}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {POST_PREVIEW_LIFETIME_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`lifetimes.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LoadingMask>
      </OverviewField>
      <Collapsible open={hasPassword && !loading}>
        <LoadingMask loading={loading}>
          <OverviewToggleRow
            checked={hasPassword}
            disabled={loading || model.deleting || updateAccess.isPending}
            hint={t("passwordHint")}
            label={t("password")}
            onCheckedChange={(checked) => {
              model.setPasswordOn(checked);
              if (checked) {
                requestAnimationFrame(() => inputRef.current?.focus());
              }
              if (!checked && live && preview?.hasPassword) {
                updateAccess.mutate({ password: null });
              }
            }}
          />
        </LoadingMask>
        <CollapsibleContent className="-mx-1 -mb-1 h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-out data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
          <form
            className="space-y-1.5 px-1 pt-2 pb-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (live && model.passwordValid) {
                updateAccess.mutate({ password });
              }
            }}
          >
            <div className="flex gap-2">
              <InputGroup>
                <InputGroupInput
                  aria-describedby={hintId}
                  aria-invalid={tooShort}
                  aria-label={t("password")}
                  autoComplete="new-password"
                  disabled={model.deleting}
                  maxLength={SITE_PREVIEW_PASSWORD_MAX_LENGTH}
                  onChange={(event) => model.setPassword(event.target.value)}
                  placeholder={
                    preview?.hasPassword
                      ? t("newPasswordPlaceholder")
                      : t("passwordPlaceholder")
                  }
                  ref={inputRef}
                  spellCheck={false}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={
                      showPassword ? t("hidePassword") : t("showPassword")
                    }
                    onClick={() => setShowPassword(!showPassword)}
                    size="icon-xs"
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={showPassword ? ViewOffIcon : ViewIcon}
                      strokeWidth={1.5}
                    />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {live ? (
                <Button
                  disabled={model.deleting || !model.passwordValid}
                  loading={savingPassword}
                  type="submit"
                  variant="outline"
                >
                  {t("savePassword")}
                </Button>
              ) : null}
            </div>
            <p
              className={`text-xs text-pretty ${tooShort ? "text-destructive" : "text-muted-foreground"}`}
              id={hintId}
            >
              {preview?.hasPassword && password.length === 0
                ? t("passwordSet")
                : t("passwordMinLength", {
                    min: SITE_PREVIEW_PASSWORD_MIN_LENGTH,
                  })}
            </p>
          </form>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function PreviewActions({ model, document }: PostSitePreviewActionsProps) {
  const t = useTranslations("content.sitePreview");
  const { preview, building, create, remove } = model;
  const loading = model.loading || model.statusLoading;
  const busy = loading || building || model.deleting;
  const exists = preview !== null;
  const missingPassword =
    model.hasPassword && !model.passwordValid && preview?.hasPassword !== true;
  return (
    <LoadingMask loading={loading}>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={
            busy ||
            model.statusFailed ||
            document.hasSaveConflict ||
            document.isSaving ||
            !document.currentMarkdown.trim() ||
            missingPassword
          }
          loading={building}
          onClick={() => create.mutate()}
          size="sm"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={exists ? Rocket01Icon : ViewIcon}
          />
          {exists ? t("update") : t("create")}
        </Button>
        <Button
          disabled={!exists || busy}
          loading={model.deleting}
          onClick={() => remove.mutate()}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} />
          {t("delete")}
        </Button>
      </div>
    </LoadingMask>
  );
}

/**
 * The post on its Notra site before it is published: built from the live
 * site plus this post, open for a chosen time, with an optional password.
 */
export function ContentSitePreviewPanel(props: ContentSitePreviewProps) {
  const t = useTranslations("content.sitePreview");
  const model = usePostSitePreview(props);
  const git = useTranslations("content.gitPublishing");
  const publication = useQuery(
    dashboardOrpc.content.pullRequestState.queryOptions({
      input: {
        organizationId: props.organizationId,
        contentId: props.contentId,
      },
    })
  );
  if (publication.data?.previewUrl) {
    return (
      <div className="p-4">
        <Button
          nativeButton={false}
          render={
            <a
              href={publication.data.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {git("preview")}
            </a>
          }
        />
      </div>
    );
  }
  if (!(model.loading || model.site)) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm">{t("noSite")}</p>
      </div>
    );
  }
  return (
    <TooltipProvider>
      <div
        aria-busy={model.loading || model.statusLoading}
        className="space-y-5 p-4"
      >
        <PreviewSummary model={model} />
        <div className="bg-border h-px" />
        <PreviewAccessFields model={model} />
        <PreviewActions document={props.document} model={model} />
      </div>
    </TooltipProvider>
  );
}

/** Renders nothing; warms the Preview tab while the post is open. */
export function ContentSitePreviewPrefetch({
  contentId,
  organizationId,
}: Pick<ContentSitePreviewProps, "contentId" | "organizationId">) {
  usePrefetchPostSitePreview(organizationId, contentId);
  return null;
}
