import { sourceMetadataSchema } from "@notra/schemas/dashboard/content";

import { CONTENT_TITLE_REGEX } from "@/constants/content-detail";
import type { ParsedSourceMetadata } from "@/types/content/detail";
import { formatSnakeCaseLabel } from "@/utils/format";

export function extractTitleFromMarkdown(
  markdown: string,
  untitledLabel: string
): string {
  const match = markdown.match(CONTENT_TITLE_REGEX);
  return match?.[1] ?? untitledLabel;
}

export function formatLookbackWindow(window: string): string {
  return formatSnakeCaseLabel(window);
}

export function formatDateRange(
  start: string,
  end: string,
  locale: string
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

/** Generation inputs worth showing, or null when they are incomplete. */
export function parseSourceMetadata(
  sourceMetadata: unknown
): ParsedSourceMetadata | null {
  if (!sourceMetadata) {
    return null;
  }

  const parsed = sourceMetadataSchema.safeParse(sourceMetadata);
  if (!parsed.success || !parsed.data) {
    return null;
  }

  const meta = parsed.data;
  const repositories = meta.repositories ?? [];
  if (
    repositories.length === 0 ||
    !meta.triggerSourceType ||
    !meta.lookbackWindow ||
    !meta.lookbackRange
  ) {
    return null;
  }

  return {
    brandVoiceId: meta.brandVoiceId,
    brandVoiceName: meta.brandVoiceName,
    lookbackRange: meta.lookbackRange,
    lookbackWindow: meta.lookbackWindow,
    repositories,
    triggerSourceType: meta.triggerSourceType,
  };
}
