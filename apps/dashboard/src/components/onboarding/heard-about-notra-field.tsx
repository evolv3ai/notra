"use client";

import type { OnboardingHeardAboutNotraSource } from "@notra/schemas/types/dashboard/onboarding";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useTranslations } from "use-intl";

import { ONBOARDING_HEARD_ABOUT_NOTRA_OPTIONS } from "@/constants/onboarding";
import { useHeardAboutLabels } from "@/lib/hooks/use-heard-about-labels";
import type { HeardAboutNotraFieldProps } from "@/types/onboarding";
import { isHeardAboutNotraSource } from "@/utils/onboarding";

export function HeardAboutNotraField({
  source,
  other,
  sourceError,
  otherError,
  disabled,
  onSourceChange,
  onOtherChange,
  onOtherBlur,
}: HeardAboutNotraFieldProps) {
  const t = useTranslations("onboarding.workspace");
  const tCommon = useTranslations("common");
  const heardAboutLabels = useHeardAboutLabels();
  const isOther = source === "other";
  const labelOf = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    return isHeardAboutNotraSource(value) ? heardAboutLabels[value] : value;
  };

  return (
    <div>
      <div className="grid gap-2">
        <Label htmlFor="heard-about-notra">
          {t("heardAbout")}{" "}
          {isOther ? null : (
            <span className="text-muted-foreground text-xs">
              {tCommon("labels.optional")}
            </span>
          )}
        </Label>
        <Select
          onValueChange={(value) => {
            if (isHeardAboutNotraSource(value)) {
              onSourceChange(value);
            }
          }}
          value={source}
        >
          <SelectTrigger
            aria-describedby={
              sourceError ? "heard-about-notra-error" : undefined
            }
            aria-invalid={Boolean(sourceError)}
            className="w-full rounded-xl px-3.5 data-[size=default]:h-11"
            disabled={disabled}
            id="heard-about-notra"
            size="default"
          >
            <SelectValue placeholder={t("selectOption")}>
              {(value) => labelOf(value) ?? t("selectOption")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ONBOARDING_HEARD_ABOUT_NOTRA_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {heardAboutLabels[option.value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sourceError ? (
          <p className="text-destructive text-sm" id="heard-about-notra-error">
            {sourceError}
          </p>
        ) : null}
      </div>

      <div
        aria-hidden={!isOther}
        className={`duration-normal grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none ${isOther ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-2 pt-5">
            <Label htmlFor="heard-about-notra-other">{t("tellUsWhere")}</Label>
            <Textarea
              aria-describedby={
                otherError ? "heard-about-notra-other-error" : undefined
              }
              aria-invalid={Boolean(otherError)}
              className="resize-none focus-visible:ring-inset"
              disabled={disabled || !isOther}
              id="heard-about-notra-other"
              onBlur={onOtherBlur}
              onChange={(e) => onOtherChange(e.target.value)}
              placeholder={t("tellUsWherePlaceholder")}
              rows={3}
              value={other}
            />
            {otherError ? (
              <p
                className="text-destructive text-sm"
                id="heard-about-notra-other-error"
              >
                {otherError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
