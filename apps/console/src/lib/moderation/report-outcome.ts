"use client";

import { toast } from "sonner";

import { MODERATION_WARNING_TOAST_MS } from "@/constants/moderation";
import type { ModerationOutcome } from "@/types/moderation";
import { moderationWarnings } from "@/utils/moderation-outcome";

/** Toasts success, or a lasting warning that lists what is left to do. */
export function reportModerationOutcome(
  success: string,
  outcome: ModerationOutcome
) {
  const warnings = moderationWarnings(outcome);
  if (warnings.length === 0) {
    toast.success(success);
    return;
  }
  toast.warning(`${success}. ${warnings.join(" ")}`, {
    duration: MODERATION_WARNING_TOAST_MS,
  });
}
