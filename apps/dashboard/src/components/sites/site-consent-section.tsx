"use client";

import { CookieIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { SiteIntegrationRow } from "@/components/sites/site-integration-row";
import { SiteInthDialog } from "@/components/sites/site-inth-dialog";
import {
  SiteSettingsGroup,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { INTH_PROVIDER } from "@/constants/site-consent";
import { useSearchParams } from "@/lib/navigation";
import type { SiteConsentSectionProps } from "@/types/components/sites";
import { inthOAuthError } from "@/utils/site-consent";

export function SiteConsentSection({
  branch,
  isSetUp,
  loading,
  disabled,
}: SiteConsentSectionProps) {
  const t = useTranslations("sites.integrationsPage.consent");
  const searchParams = useSearchParams();
  const oauthError = inthOAuthError(searchParams.get("error"));
  const [open, setOpen] = useState(
    () => oauthError !== null || searchParams.has("inthConnected")
  );

  return (
    <SiteSettingsGroup icon={CookieIcon} title={t("title")}>
      <SiteSettingsList>
        <SiteIntegrationRow
          addAriaLabel={t("connect")}
          addLabel={t("connectShort")}
          description={t("description")}
          disabled={disabled}
          isSetUp={isSetUp}
          loading={loading}
          onOpen={() => setOpen(true)}
          provider={INTH_PROVIDER}
        />
      </SiteSettingsList>
      <SiteInthDialog
        branch={branch}
        isSetUp={isSetUp}
        oauthError={oauthError}
        onOpenChange={setOpen}
        open={open}
      />
    </SiteSettingsGroup>
  );
}
