import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  ScheduleOutputType,
  WebhookEventType,
} from "@notra/schemas/dashboard/integrations";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useStore } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorSection,
  PICKER_CHIP_CLASS,
  PickerSelect,
} from "@/components/automation/editor/editor-parts";
import { SourcePicker } from "@/components/automation/editor/source-picker";
import { OUTPUT_TYPE_LABEL_KEYS } from "@/constants/automation-output-types";
import { FORMAT_ORDER } from "@/constants/content-formats";
import { EVENT_TYPE_META, EVENT_TYPE_ORDER } from "@/constants/event-triggers";
import type { EventTriggerSectionProps } from "@/types/automation/event-trigger";

import { IgnoreCommitPatternsField } from "./ignore-commit-patterns-field";
import { TriggerSwitchRow } from "./trigger-switch-row";

/** Event, repositories and format read as one sentence, then event options. */
export function EventTriggerSection({
  form,
  options,
  isLoading,
  onAddRepository,
  kindPicker,
}: EventTriggerSectionProps) {
  const t = useTranslations("automation.events.dialog");
  const tEvents = useTranslations("automation.events.eventTypes");
  const tLabels = useTranslations("common.labels");
  const eventType = useStore(form.store, (s) => s.values.eventType);

  let repositories = (
    <form.Field name="repositoryIds">
      {(field) => (
        <SourcePicker
          ariaLabel={t("repositories")}
          emptyLabel={tLabels("noRepositoriesFound")}
          invalid={field.state.meta.errors.length > 0}
          onChange={field.handleChange}
          options={options}
          placeholder={t("pickRepositories")}
          searchPlaceholder={tLabels("searchRepositories")}
          value={field.state.value}
        />
      )}
    </form.Field>
  );
  if (isLoading) {
    repositories = <Skeleton className="h-8 w-40 rounded-lg" />;
  } else if (options.length === 0) {
    repositories = (
      <button
        className={PICKER_CHIP_CLASS}
        onClick={onAddRepository}
        type="button"
      >
        <HugeiconsIcon className="size-3.5" icon={Add01Icon} />
        {t("connectRepository")}
      </button>
    );
  }

  return (
    <EditorSection hint={t("triggerHint")} label={t("trigger")}>
      <EditorBox>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("sentence.when")}</span>
          <form.Field name="eventType">
            {(field) => (
              <PickerSelect
                ariaLabel={t("event")}
                onChange={(next) =>
                  field.handleChange(next as WebhookEventType)
                }
                options={EVENT_TYPE_ORDER.map((type) => ({
                  value: type,
                  label:
                    type === "release"
                      ? tLabels("releasePublished")
                      : tEvents(`${type}.label`),
                  icon: EVENT_TYPE_META[type].icon,
                }))}
                value={field.state.value}
              />
            )}
          </form.Field>
          <span className="text-muted-foreground">{t("sentence.in")}</span>
          {repositories}
          <span className="text-muted-foreground">{t("sentence.draft")}</span>
          <form.Field name="outputType">
            {(field) => (
              <PickerSelect
                ariaLabel={t("format")}
                onChange={(next) =>
                  field.handleChange(next as ScheduleOutputType)
                }
                options={FORMAT_ORDER.map((type) => ({
                  value: type,
                  label: tLabels(OUTPUT_TYPE_LABEL_KEYS[type]),
                }))}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        {eventType === "push" ? (
          <form.Field name="ignoreCommitPatternsText">
            {(field) => (
              <IgnoreCommitPatternsField
                errors={field.state.meta.errors}
                fieldName={field.name}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                value={field.state.value}
              />
            )}
          </form.Field>
        ) : (
          <form.Field name="includePreReleases">
            {(field) => (
              <TriggerSwitchRow
                checked={field.state.value}
                id={field.name}
                label={t("includePreReleases")}
                onCheckedChange={field.handleChange}
                tooltip={t("includePreReleasesHint")}
              />
            )}
          </form.Field>
        )}
        {kindPicker}
      </EditorBox>
    </EditorSection>
  );
}
