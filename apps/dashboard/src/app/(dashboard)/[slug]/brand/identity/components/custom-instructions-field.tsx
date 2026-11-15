import { Textarea } from "@notra/ui/components/ui/textarea";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import type { CustomInstructionsFieldProps } from "@/types/brand-identity";

export function CustomInstructionsField({
  form,
}: CustomInstructionsFieldProps) {
  const t = useTranslations("brand.identity.form");
  return (
    <TitleCard className="lg:col-span-2" heading={t("customInstructionsLabel")}>
      <form.Field name="customInstructions">
        {(field) => (
          <Textarea
            aria-label={t("customInstructionsLabel")}
            className="max-h-96 min-h-24"
            id={field.name}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={t("customInstructionsPlaceholder")}
            value={field.state.value}
          />
        )}
      </form.Field>
    </TitleCard>
  );
}
