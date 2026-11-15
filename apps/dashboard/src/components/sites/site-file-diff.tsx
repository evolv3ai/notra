"use client";

import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import type { FileDiffOptions } from "@pierre/diffs/react";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import {
  SITE_CODE_DIFF_CSS,
  SITE_CODE_SURFACE_CLASS,
  SITE_CODE_THEME,
} from "@/constants/site-publish-diff";
import { cn } from "@/lib/utils";
import type { SiteFileDiffProps } from "@/types/components/site-publish";
import { siteCodeThemeType } from "@/utils/site-drafts";

export function SiteFileDiff(props: SiteFileDiffProps) {
  const { resolvedTheme } = useTheme();
  const parsed = "fileDiff" in props ? props.fileDiff : undefined;
  const path = "path" in props ? props.path : "";
  const before = "before" in props ? props.before : null;
  const after = "after" in props ? props.after : null;
  const fileDiff = useMemo(
    () =>
      parsed ??
      parseDiffFromFile(
        before === null ? null : { name: path, contents: before },
        after === null ? null : { name: path, contents: after }
      ),
    [parsed, path, before, after]
  );
  const options = useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: SITE_CODE_THEME,
      themeType: siteCodeThemeType(resolvedTheme),
      diffStyle: "unified",
      disableFileHeader: true,
      overflow: "wrap",
      hunkSeparators: "line-info-basic",
      diffIndicators: "bars",
      lineDiffType: "word",
      unsafeCSS: SITE_CODE_DIFF_CSS,
    }),
    [resolvedTheme]
  );

  return (
    <FileDiff
      className={cn(SITE_CODE_SURFACE_CLASS, props.className)}
      disableWorkerPool
      fileDiff={fileDiff}
      options={options}
    />
  );
}
