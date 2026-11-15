"use client";

import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { isDemoModeClient } from "@notra/utils/demo-mode";
import { useSetActiveUI } from "c15t/tanstack-start";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useHidePersonalData } from "@/lib/hooks/use-privacy-preferences";

export function PrivacySection() {
  const t = useTranslations("settings.privacy");
  const { hidePersonalData, hasHydrated, isUpdating, setHidePersonalData } =
    useHidePersonalData();

  return (
    <TitleCard heading={t("heading")}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label
            className="cursor-pointer text-sm font-medium"
            htmlFor="hide-personal-data"
          >
            {t("hidePersonalData")}
          </Label>
          <p className="text-muted-foreground text-xs">
            {t("hidePersonalDataDescription")}
          </p>
        </div>
        <Switch
          checked={hidePersonalData}
          disabled={!hasHydrated || isUpdating}
          id="hide-personal-data"
          onCheckedChange={setHidePersonalData}
        />
      </div>
      {isDemoModeClient() ? null : <CookiePreferences />}
    </TitleCard>
  );
}

function CookiePreferences() {
  const t = useTranslations("settings.privacy");
  const setActiveConsentUI = useSetActiveUI();

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{t("cookies")}</p>
        <p className="text-muted-foreground text-xs">
          {t("cookiesDescription")}
        </p>
      </div>
      <Button
        onClick={() => setActiveConsentUI("dialog")}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("manageCookies")}
      </Button>
    </div>
  );
}
