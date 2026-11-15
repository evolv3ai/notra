import { PROMPTS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import { ONBOARDING_WEBSITE_PREFIX_REGEX } from "@notra/geo-core/constants/website-url";
import { ONBOARDING_HEARD_ABOUT_NOTRA_SOURCES } from "@notra/schemas/constants/dashboard/onboarding";
import type { OnboardingHeardAboutNotraSource } from "@notra/schemas/types/dashboard/onboarding";
import { DATA_TABLE_HEADER_HEIGHT } from "ui/table/constants";

import {
  ONBOARDING_PREVIEW_EMPTY_TABLE_ROWS,
  ONBOARDING_PREVIEW_LENS_MARGIN_PX,
  ONBOARDING_PREVIEW_LENS_PADDING_PX,
  ONBOARDING_PREVIEW_ZOOM,
  WORKSPACE_FIELD_INPUT_IDS,
} from "@/constants/onboarding";
import type {
  OnboardingPreviewFocus,
  OnboardingPreviewLens,
  WorkspaceFormField,
} from "@/types/onboarding";

export function isHeardAboutNotraSource(
  value: string | null | undefined
): value is OnboardingHeardAboutNotraSource {
  return ONBOARDING_HEARD_ABOUT_NOTRA_SOURCES.some(
    (source) => source === value
  );
}

export function stripWebsitePrefix(value: string): string {
  return value.replace(ONBOARDING_WEBSITE_PREFIX_REGEX, "");
}

function isOnboardingPreviewFocus(
  value: string | undefined
): value is OnboardingPreviewFocus {
  return value !== undefined && Object.hasOwn(ONBOARDING_PREVIEW_ZOOM, value);
}

function previewFocusOf(target: EventTarget | null) {
  const value =
    target instanceof HTMLElement
      ? target.closest<HTMLElement>("[data-preview]")?.dataset.preview
      : undefined;
  return isOnboardingPreviewFocus(value) ? value : null;
}

export function onboardingPreviewFocusProps(
  setFocus: (focus: OnboardingPreviewFocus | null) => void
) {
  return {
    onFocusCapture: (event: React.FocusEvent) =>
      setFocus(previewFocusOf(event.target)),
    onBlurCapture: (event: React.FocusEvent) => {
      if (document.hasFocus() && !previewFocusOf(event.relatedTarget)) {
        setFocus(null);
      }
    },
  };
}

export function onboardingPreviewHost(website: string | undefined): string {
  return stripWebsitePrefix(website ?? "").split("/")[0] ?? "";
}

export function onboardingPreviewTableHeight(rows: number): number {
  return (
    DATA_TABLE_HEADER_HEIGHT +
    Math.max(rows, ONBOARDING_PREVIEW_EMPTY_TABLE_ROWS) *
      PROMPTS_TABLE_ROW_HEIGHT
  );
}

export function onboardingPreviewLens(
  viewport: Element,
  target: Element,
  maxScale: number
): OnboardingPreviewLens {
  const bounds = viewport.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const outerWidth = rect.width + ONBOARDING_PREVIEW_LENS_PADDING_PX * 2;
  const outerHeight = rect.height + ONBOARDING_PREVIEW_LENS_PADDING_PX * 2;
  const room = ONBOARDING_PREVIEW_LENS_MARGIN_PX * 2;
  const scale = Math.max(
    1,
    Math.min(
      maxScale,
      (bounds.width - room) / outerWidth,
      (bounds.height - room) / outerHeight
    )
  );
  const place = (center: number, size: number, total: number) =>
    Math.max(
      ONBOARDING_PREVIEW_LENS_MARGIN_PX,
      Math.min(
        center - size / 2,
        total - ONBOARDING_PREVIEW_LENS_MARGIN_PX - size
      )
    );
  const x = place(
    rect.left - bounds.left + rect.width / 2,
    outerWidth * scale,
    bounds.width
  );
  const y = place(
    rect.top - bounds.top + rect.height / 2,
    outerHeight * scale,
    bounds.height
  );
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    width: rect.width,
    height: rect.height,
  };
}

export function focusFirstInvalidWorkspaceField(
  fieldMeta: Partial<
    Record<WorkspaceFormField, { errors: readonly unknown[] } | undefined>
  >
) {
  for (const [field, id] of WORKSPACE_FIELD_INPUT_IDS) {
    const input = fieldMeta[field]?.errors.length
      ? document.getElementById(id)
      : null;
    if (input && !input.hasAttribute("disabled")) {
      requestAnimationFrame(() => input.focus());
      return;
    }
  }
}

export function onboardingPreviewLogoName(
  logoName: string | undefined,
  placeholder: string
): string | undefined {
  return logoName === undefined ? undefined : logoName.trim() || placeholder;
}
