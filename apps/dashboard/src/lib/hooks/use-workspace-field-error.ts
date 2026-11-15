"use client";

import { useTranslations } from "use-intl";

import type { WorkspaceFormField } from "@/types/onboarding";

export function useWorkspaceFieldError() {
  const t = useTranslations("onboarding.workspace");
  const tCommon = useTranslations("common");
  const messageOf = (field: WorkspaceFormField, error: unknown) => {
    if (typeof error === "string") {
      return error;
    }
    if (!(error && typeof error === "object")) {
      return t("validation.checkField");
    }
    const code = "code" in error ? error.code : undefined;
    if (field === "name" && code === "too_small") {
      return tCommon("messages.organizationNameTooShort");
    }
    if (field === "name" && code === "too_big") {
      return tCommon("messages.organizationNameTooLong");
    }
    if (field === "slug" && code === "too_small") {
      return tCommon("messages.organizationSlugTooShort");
    }
    if (field === "slug" && code === "too_big") {
      return tCommon("messages.organizationSlugTooLong");
    }
    if (field === "slug" && code === "custom") {
      return tCommon("messages.thisSlugIsReservedAnd");
    }
    if (field === "websiteUrl") {
      return t("validation.websiteInvalid");
    }
    if (field === "heardAboutNotraOther" && code === "custom") {
      return t("validation.heardAboutOtherRequired");
    }
    if ("message" in error) {
      return String(error.message);
    }
    return t("validation.checkField");
  };
  return (field: WorkspaceFormField, errors: readonly unknown[]) =>
    errors.length > 0 ? messageOf(field, errors[0]) : null;
}
