import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@notra/ui/components/ui/select";
import { useTranslations } from "use-intl";

import type { ContentPublishingTargetProps } from "@/types/content/git-publishing";

export function ContentPublishingTarget({
  config,
  siteId,
  onSiteChange,
  branch,
  disabled,
}: ContentPublishingTargetProps) {
  const t = useTranslations("content.gitPublishing");
  return (
    <div className="space-y-3">
      {config.sites.length > 1 ? (
        <Field>
          <FieldLabel>{t("site")}</FieldLabel>
          <Select
            value={siteId ?? null}
            onValueChange={(value) => {
              if (value) {
                onSiteChange(value);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger aria-label={t("site")}>
              <SelectValue placeholder={t("chooseSite")}>
                {config.sites.find((site) => site.id === siteId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {config.sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name} · {site.rootDirectory || "/"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <p className="text-muted-foreground text-sm">
        {config.reviewProcess === "direct"
          ? t("publishesDirectly", { branch })
          : `${t("opensPullRequest")} · ${branch}`}
      </p>
    </div>
  );
}
