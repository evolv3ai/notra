"use client";

import {
  Alert02Icon,
  Delete02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { type ReactNode, useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import {
  useSiteWorkspace,
  useSiteWorkspaceLoad,
} from "@/components/sites/site-workspace-context";
import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
import {
  SITE_CHANGES_STRIP_TONES,
  SITE_CHANGES_VISIBLE,
} from "@/constants/sites";
import { useSiteNavSection } from "@/lib/hooks/use-site-nav-section";
import { cn } from "@/lib/utils";
import type {
  SiteChangeItem,
  SiteChangeListProps,
  SiteChangesStripProps,
  SiteChangesStripStateProps,
  SiteDiscardChangesButtonProps,
} from "@/types/components/sites";
import type { SiteWorkspaceValue } from "@/types/site-workspace";
import { siteBranchLabel } from "@/utils/site-branch-label";
import { configSectionChanged } from "@/utils/site-design-sections";
import { siteHref } from "@/utils/site-links";
import {
  siteUnpublishedTitle,
  splitVisibleChanges,
} from "@/utils/site-unpublished-summary";

function Strip({ tone, title, description, children }: SiteChangesStripProps) {
  return (
    <div
      className={cn(
        "bg-background animate-in fade-in-0 slide-in-from-top-1 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-linear-to-b px-4 py-2 duration-200 motion-reduce:animate-none sm:sticky sm:top-0 lg:px-5",
        SITE_CHANGES_STRIP_TONES[tone]
      )}
      role={tone === "info" ? "status" : "alert"}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 max-sm:mt-0.5 max-sm:self-start",
          tone === "info" && "text-info"
        )}
        icon={tone === "info" ? InformationCircleIcon : Alert02Icon}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
        <p className="font-medium">{title}</p>
        <p className="opacity-80">{description}</p>
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Unpublished edits, save failures, invalid config and conflicts, shown once above the page content. Publish lives in the site header. */
export function SiteChangesBanner() {
  const state = useSiteWorkspace();
  const load = useSiteWorkspaceLoad();
  const { organizationSlug, detail } = useSite();
  const { current } = useSiteNavSection(organizationSlug, detail.site.id);
  // Without a workspace the Design page shows the failure in place of its form.
  if (load.failed && (state || current !== "design")) {
    return <SiteLoadFailedStrip />;
  }
  if (!state || state.malformed) {
    return null;
  }
  return <SiteChangesStrip state={state} />;
}

function SiteLoadFailedStrip() {
  const t = useTranslations("sites.design");
  const load = useSiteWorkspaceLoad();
  return (
    <Strip
      description={t("errors.loadDescription")}
      title={t("errors.loadTitle")}
      tone="destructive"
    >
      <Button
        loading={load.retrying}
        size="sm"
        variant="outline"
        onClick={load.retry}
      >
        {t("workspace.tryAgain")}
      </Button>
    </Strip>
  );
}

function SiteChangesStrip({ state }: SiteChangesStripStateProps) {
  const t = useTranslations("sites.design.workspace");
  const banner = useTranslations("sites.design.workspace.banner");
  const busy = discardBusy(state);
  const discard = <SiteDiscardChangesButton state={state} />;
  if (state.conflicts.length > 0) {
    return (
      <Strip
        description={banner("conflict")}
        title={banner("conflictTitle")}
        tone="destructive"
      >
        <Button
          disabled={busy}
          size="sm"
          variant="ghost"
          onClick={() => {
            void state.resolveConflict(false);
          }}
        >
          {t("discardChanges")}
        </Button>
        <Button
          disabled={busy || state.invalid}
          size="sm"
          variant="outline"
          onClick={() => {
            void state.resolveConflict(true);
          }}
        >
          {t("keepChanges")}
        </Button>
      </Strip>
    );
  }
  if (state.saves.state.status === "error") {
    return (
      <Strip
        description={banner("saveFailed")}
        title={banner("saveFailedTitle")}
        tone="destructive"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={state.controller.retrySave}
        >
          {banner("retry")}
        </Button>
        {discard}
      </Strip>
    );
  }
  if (state.brokenSource) {
    return (
      <Strip
        description={
          <>
            {banner("brokenSource")} <SiteConfigIssues state={state} />
          </>
        }
        title={banner("brokenSourceTitle")}
        tone="warning"
      >
        <Button
          disabled={busy}
          size="sm"
          variant="outline"
          onClick={state.repair}
        >
          {banner("repair")}
        </Button>
      </Strip>
    );
  }
  if (state.invalid) {
    return (
      <Strip
        description={
          <>
            {banner("invalid")} <SiteConfigIssues state={state} />
          </>
        }
        title={banner("invalidTitle")}
        tone="warning"
      >
        {discard}
      </Strip>
    );
  }
  return <SiteUnpublishedStrip state={state} />;
}

function SiteConfigIssues({ state }: SiteChangesStripStateProps) {
  const banner = useTranslations("sites.design.workspace.banner");
  const paths = [
    ...new Set(state.issues.map((issue) => issue.path || SITE_CONFIG_FILENAME)),
  ];
  return (
    <>
      {paths.slice(0, 3).map((path, index) => (
        <span key={path}>
          {index > 0 ? ", " : null}
          <code className="font-mono text-xs">{path}</code>
        </span>
      ))}
      {paths.length > 3
        ? ` ${banner("moreIssues", { count: paths.length - 3 })}`
        : null}
    </>
  );
}

function discardBusy(state: SiteWorkspaceValue) {
  return (
    state.readOnly ||
    state.uploading ||
    state.saves.state.status === "saving" ||
    state.controller.props.commitStatus === "pending"
  );
}

function SiteUnpublishedStrip({ state }: SiteChangesStripStateProps) {
  const unpublished = useUnpublishedSummary(state);
  if (!unpublished) {
    return null;
  }
  return (
    <Strip tone="info" {...unpublished}>
      {state.files.drafts.length > 0 || state.unsaved ? (
        <SiteDiscardChangesButton state={state} variant="ghost" />
      ) : null}
    </Strip>
  );
}

const CHANGE_LINK_CLASS =
  "decoration-current/40 hover:decoration-current focus-visible:ring-ring/50 rounded-xs underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2";

/** "General, Navbar and launch.mdx": each change links to where it was made. */
function SiteChangeList({ items, more, onReview }: SiteChangeListProps) {
  const banner = useTranslations("sites.design.workspace.banner");
  const locale = useLocale();
  const listFormat = useMemo(
    () => new Intl.ListFormat(locale, { type: "conjunction" }),
    [locale]
  );
  const entries: readonly SiteChangeItem[] =
    more > 0
      ? [
          ...items,
          { key: "more", label: banner("moreChanges", { count: more }) },
        ]
      : items;
  const parts = listFormat.formatToParts(entries.map((entry) => entry.label));
  const nodes: ReactNode[] = [];
  let next = 0;
  for (const part of parts) {
    const entry = entries[next];
    if (part.type === "literal" || !entry) {
      nodes.push(<span key={`before-${entry?.key}`}>{part.value}</span>);
      continue;
    }
    next += 1;
    nodes.push(
      entry.href ? (
        <Link className={CHANGE_LINK_CLASS} href={entry.href} key={entry.key}>
          {entry.label}
        </Link>
      ) : (
        <button
          className={cn(CHANGE_LINK_CLASS, "cursor-pointer")}
          key={entry.key}
          onClick={onReview}
          title={entry.title}
          type="button"
        >
          {entry.label}
        </button>
      )
    );
  }
  return nodes;
}

function SiteDiscardChangesButton({
  state,
  variant = "secondary",
}: SiteDiscardChangesButtonProps) {
  const banner = useTranslations("sites.design.workspace.banner");
  const common = useTranslations("common");
  const branches = useTranslations("sites.branches");
  const { discardOpen, setDiscardOpen } = state;
  const [discardError, setDiscardError] = useState(false);
  const busy = discardBusy(state);
  return (
    <ResponsiveDialog
      open={discardOpen}
      onOpenChange={(open) => {
        if (!state.readOnly) {
          setDiscardOpen(open);
          setDiscardError(false);
        }
      }}
    >
      <ResponsiveDialogTrigger
        render={<Button disabled={busy} size="sm" variant={variant} />}
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={Delete02Icon}
          strokeWidth={2}
        />
        {branches("discard")}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {banner("discardTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {banner("discardDescription")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {discardError ? <p role="alert">{banner("discardFailed")}</p> : null}
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            disabled={state.readOnly}
            onClick={() => setDiscardOpen(false)}
          >
            {common("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={state.readOnly}
            disabled={busy}
            onClick={async () => {
              setDiscardError(false);
              try {
                await state.discardChanges();
                setDiscardOpen(false);
              } catch {
                setDiscardError(true);
              }
            }}
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Delete02Icon}
              strokeWidth={2}
            />
            {banner("discardAction")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** One entry per change: Design sections and settings link to their page, files open the review. */
function useChangeItems(state: SiteWorkspaceValue) {
  const { organizationSlug, detail } = useSite();
  const banner = useTranslations("sites.design.workspace.banner");
  const titles = useTranslations("sites.design.sections.titles");
  const { site } = detail;
  const href = (target: "design" | "settings", section?: string) => {
    const url = new URL(
      siteHref(organizationSlug, site.id, target, site.projectId),
      "http://localhost"
    );
    if (section) {
      url.searchParams.set("section", section);
    }
    if (state.scope.branch) {
      url.searchParams.set("branch", state.scope.branch);
    }
    return `${url.pathname}${url.search}`;
  };
  const sections = SITE_DESIGN_SECTIONS.filter((section) =>
    configSectionChanged(state.config, state.published, section.paths)
  ).map((section) => ({
    key: section.id,
    label: titles(section.id),
    href: href("design", section.id),
  }));
  // Variables and other keys outside the Design sections still differ from
  // production after a feature branch commits them and its drafts clear.
  const configChanged = configSectionChanged(state.config, state.published, [
    ...new Set([...Object.keys(state.config), ...Object.keys(state.published)]),
  ]);
  const settings =
    configChanged && sections.length === 0
      ? [
          {
            key: "settings",
            label: banner("siteSettings"),
            href: href("settings"),
          },
        ]
      : [];
  // Uploaded images travel with the section that references them.
  const files = state.files.drafts
    .filter(
      (draft) =>
        draft.path !== SITE_CONFIG_FILENAME && !isSiteImageDraftPath(draft.path)
    )
    .map((draft) => ({
      key: draft.path,
      label: draft.path.split("/").at(-1) ?? draft.path,
      title: draft.path,
    }));
  return { sections, settings, files, configChanged };
}

function useUnpublishedSummary(state: SiteWorkspaceValue) {
  const { detail } = useSite();
  const banner = useTranslations("sites.design.workspace.banner");
  const branches = useTranslations("sites.branches");
  const locale = useLocale();
  const { sections, settings, files, configChanged } = useChangeItems(state);
  const branch = state.scope.branch;
  const feature = Boolean(branch && branch !== detail.site.productionBranch);
  // Committed branch edits leave no drafts behind, so they are only counted.
  const branchFiles = feature
    ? (state.controller.queries.status.data?.changedFiles ?? 0)
    : 0;
  if (!configChanged && state.files.drafts.length === 0 && branchFiles === 0) {
    return null;
  }
  const items: SiteChangeItem[] = [...sections, ...settings, ...files];
  const drafts = state.files.drafts.length;
  const heading = siteUnpublishedTitle({
    sections: sections.length,
    files: files.length,
    drafts,
    branchFiles,
  });
  const title = banner(heading.key, { count: heading.count });
  const branchName = siteBranchLabel(branch ?? "", locale, (date) =>
    branches("draftFrom", { date })
  );
  if (items.length === 0) {
    return {
      title,
      description: feature
        ? banner("unpublishedBranchFiles", { branch: branchName })
        : banner("unpublishedFiles"),
    };
  }
  const { visible, more } = splitVisibleChanges(
    items,
    Math.max(0, branchFiles - drafts),
    SITE_CHANGES_VISIBLE
  );
  const list = () => (
    <SiteChangeList
      items={visible}
      more={more}
      onReview={() => state.setPublishOpen(true)}
    />
  );
  return {
    title,
    description: feature
      ? banner.rich("unpublishedBranch", { list, branch: branchName })
      : banner.rich("unpublished", { list }),
  };
}
