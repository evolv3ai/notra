import type { ToneProfile } from "@notra/ai/schemas/tone";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";
import {
  InputGroupAddon,
  InputGroupText,
} from "@notra/ui/components/ui/input-group";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { LANGUAGE_OPTIONS, TONE_OPTIONS } from "@/constants/brand-identity";
import { useLanguageLabel } from "@/lib/hooks/use-language-label";
import type { ToneLanguageFieldsProps } from "@/types/brand-identity";
import { getLanguageFlag } from "@/utils/brand-identity";

export function ToneLanguageFields({
  form,
  userLocales,
}: ToneLanguageFieldsProps) {
  const t = useTranslations("brand.identity.form");
  const tCommon = useTranslations("common");
  const getLanguageLabel = useLanguageLabel();
  const toneSelectItems = Object.fromEntries(
    TONE_OPTIONS.map((option) => [
      option.value,
      t(`tones.${option.value}.label`),
    ])
  );
  return (
    <form.Field name="useCustomTone">
      {(useCustomToneField) => (
        <TitleCard
          action={
            <Tabs
              onValueChange={(value) => {
                const useCustomTone = value === "custom";
                useCustomToneField.handleChange(useCustomTone);
                if (!useCustomTone) {
                  form.setFieldValue("customTone", "");
                }
              }}
              value={useCustomToneField.state.value ? "custom" : "preset"}
            >
              <TabsList aria-label={t("toneLabel")} className="h-7">
                <TabsTrigger className="text-xs" value="preset">
                  {t("toneModePreset")}
                </TabsTrigger>
                <TabsTrigger className="text-xs" value="custom">
                  {t("toneModeCustom")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          heading={t("toneLanguageHeading")}
        >
          <div className="space-y-6">
            {useCustomToneField.state.value ? (
              <form.Field name="customTone">
                {(customToneField) => (
                  <div className="space-y-2">
                    <Label htmlFor={customToneField.name}>
                      {t("customToneLabel")}
                    </Label>
                    <Textarea
                      className="max-h-60 min-h-24"
                      id={customToneField.name}
                      onBlur={customToneField.handleBlur}
                      onChange={(event) =>
                        customToneField.handleChange(event.target.value)
                      }
                      placeholder={t("customTonePlaceholder")}
                      value={customToneField.state.value}
                    />
                  </div>
                )}
              </form.Field>
            ) : (
              <form.Field name="toneProfile">
                {(toneProfileField) => (
                  <div className="space-y-2">
                    <Label>{t("toneProfileLabel")}</Label>
                    <Select
                      items={toneSelectItems}
                      onValueChange={(value) => {
                        if (value) {
                          toneProfileField.handleChange(value as ToneProfile);
                        }
                      }}
                      value={toneProfileField.state.value}
                    >
                      <SelectTrigger
                        aria-label={t("toneProfileLabel")}
                        className="w-full"
                      >
                        <SelectValue placeholder={t("selectTone")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {TONE_OPTIONS.map((option) => (
                          <SelectItem
                            className="items-start"
                            key={option.value}
                            value={option.value}
                          >
                            <span className="flex min-w-0 flex-col items-start gap-0.5">
                              <span>{t(`tones.${option.value}.label`)}</span>
                              <span className="text-muted-foreground text-xs whitespace-normal">
                                {t(`tones.${option.value}.description`)}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t("toneScopeNote")}
                    </p>
                  </div>
                )}
              </form.Field>
            )}

            <form.Field name="language">
              {(field) => (
                <div className="space-y-2">
                  <Label>{tCommon("labels.language")}</Label>
                  <Combobox
                    itemToStringLabel={getLanguageLabel}
                    items={LANGUAGE_OPTIONS}
                    onValueChange={(value) => {
                      if (value) {
                        field.handleChange(value);
                      }
                    }}
                    value={field.state.value}
                  >
                    <ComboboxInput placeholder={t("selectLanguage")}>
                      <InputGroupAddon align="inline-start">
                        <InputGroupText aria-hidden="true">
                          {getLanguageFlag(field.state.value, userLocales)}
                        </InputGroupText>
                      </InputGroupAddon>
                    </ComboboxInput>
                    <ComboboxContent>
                      <ComboboxEmpty>{t("noLanguageFound")}</ComboboxEmpty>
                      <ComboboxList>
                        {(language) => (
                          <ComboboxItem key={language} value={language}>
                            <span
                              aria-hidden="true"
                              className="text-base leading-none"
                            >
                              {getLanguageFlag(language, userLocales)}
                            </span>
                            <span>{getLanguageLabel(language)}</span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              )}
            </form.Field>
          </div>
        </TitleCard>
      )}
    </form.Field>
  );
}
