"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { COMPANY_LOGO_DEBOUNCE_MS } from "@/constants/company-logo";
import { extractDomain } from "@/lib/onboarding/company-logo";
import {
  MAX_LOGO_FILE_SIZE_MB,
  readFileAsDataUrl,
  validateLogoFile,
} from "@/lib/onboarding/logo-file";
import type { OnboardingExistingOrg } from "@/types/onboarding";
import { resolveOrganizationLogo } from "@/utils/avatar";
import { getGoogleFaviconUrl } from "@/utils/brand";

export function useWorkspaceLogo(
  existingOrg: OnboardingExistingOrg | undefined
) {
  const t = useTranslations("onboarding.workspace");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    resolveOrganizationLogo(existingOrg?.logo) ?? null
  );
  const [websiteValue, setWebsiteValue] = useState(
    existingOrg?.websiteUrl ?? ""
  );
  const [debouncedWebsite] = useDebouncedValue(websiteValue, {
    wait: COMPANY_LOGO_DEBOUNCE_MS,
  });
  const companyDomain = extractDomain(debouncedWebsite);
  const fetchedLogoUrl = logoFile
    ? null
    : (getGoogleFaviconUrl(companyDomain) ?? null);

  const selectLogo = async (file: File) => {
    const validationError = validateLogoFile(file);
    if (validationError) {
      toast.error(
        validationError === "tooLarge"
          ? t("logoTooLarge", { size: MAX_LOGO_FILE_SIZE_MB })
          : t("logoInvalidType")
      );
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoFile(file);
      setLogoPreviewUrl(dataUrl);
    } catch {
      toast.error(t("logoReadFailed"));
    }
  };

  return {
    logoFile,
    logoUrl: logoPreviewUrl ?? fetchedLogoUrl,
    companyDomain,
    websiteValue,
    setWebsiteValue,
    selectLogo,
  };
}
