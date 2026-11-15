"use client";

import {
  Add01Icon,
  AlertCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS } from "@notra/ai/constants/schedule-interval";
import { toUtcDateString } from "@notra/ai/utils/schedule-interval";
import type { ScheduleFormValues } from "@notra/schemas/dashboard/automation/schedule-form";
import {
  LOOKBACK_WINDOWS,
  type LookbackWindow,
  MAX_SCHEDULE_INSTRUCTIONS_LENGTH,
  type ScheduleOutputType,
  MAX_SCHEDULE_NAME_LENGTH,
} from "@notra/schemas/dashboard/integrations";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorFooter,
  EditorHeader,
  EditorPad,
  EditorSection,
  PICKER_CHIP_CLASS,
  PickerSelect,
} from "@/components/automation/editor/editor-parts";
import { AutomationNotifySection } from "@/components/automation/editor/notify-section";
import { SourcePicker } from "@/components/automation/editor/source-picker";
import { TriggerSwitchRow } from "@/components/automation/events/trigger-switch-row";
import { Button } from "@/components/button";
import { AddRepositoryDialog } from "@/components/integrations/add-repository-dialog";
import { LegacyAddIntegrationDialog as AddIntegrationDialog } from "@/components/integrations/legacy/add-integration-dialog";
import { OUTPUT_TYPE_LABEL_KEYS } from "@/constants/automation-output-types";
import { FORMAT_ORDER } from "@/constants/content-formats";
import { LOOKBACK_WINDOW_COMMON_LABEL_KEYS } from "@/constants/schedule";
import { supportsAutoPublish } from "@/constants/schedule-output-types";
import { dashboardOrpc } from "@/lib/orpc/query";
import { createScheduleFormSchema } from "@/schemas/schedule-form";
import type {
  ScheduleFormProps,
  ScheduleCron,
} from "@/types/automation/schedule";
import type { SourceOption } from "@/types/automation/source-picker";
import type { Trigger } from "@/types/triggers/triggers";
import { getOrpcErrorDataCode } from "@/utils/orpc-errors";
import {
  buildAutoScheduleName,
  getDefaultScheduleValues,
} from "@/utils/schedule-form";

import { ScheduleTriggerRow } from "./schedule-trigger-row";

export function ScheduleForm({
  organizationId,
  onSuccess,
  editTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  presetId,
  presetValues,
  kindPicker,
}: ScheduleFormProps) {
  const t = useTranslations("automation.schedules");
  const tAutomationShared = useTranslations("automation.shared");
  const tValidation = useTranslations("automation.schedules.validation");
  const tCommon = useTranslations("common");
  const lookbackLabel = (window: LookbackWindow) =>
    window === "current_day"
      ? t("lookbackWindows.current_day")
      : tCommon(`labels.${LOOKBACK_WINDOW_COMMON_LABEL_KEYS[window]}`);
  const scheduleFormSchema = useMemo(
    () => createScheduleFormSchema(tValidation),
    [tValidation]
  );
  const isEditMode = !!editTrigger;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(next);
      } else {
        setInternalOpen(next);
      }
    },
    [controlledOnOpenChange, isControlled]
  );

  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [enabled, setEnabled] = useState(editTrigger?.enabled ?? true);

  const mutation = useMutation<{ trigger: Trigger }, Error, ScheduleFormValues>(
    {
      mutationFn: async (value) => {
        const githubRepoIds = value.repositoryIds.filter(
          (id) => !id.startsWith("linear:")
        );

        const instructions = value.instructions.trim();
        const schedulePayload = {
          organizationId,
          name: value.name.trim(),
          sourceType: "cron" as const,
          sourceConfig: { cron: value.schedule },
          targets: {
            repositoryIds: githubRepoIds,
            linearIntegrationIds: value.repositoryIds
              .filter((id) => id.startsWith("linear:"))
              .map((id) => id.slice("linear:".length)),
          },
          outputType: value.outputType,
          outputConfig: {
            ...(value.brandVoiceId ? { brandVoiceId: value.brandVoiceId } : {}),
            ...(instructions ? { instructions } : {}),
            notify: value.notify,
          },
          enabled,
          autoPublish: supportsAutoPublish(value.outputType)
            ? value.autoPublish
            : false,
          lookbackWindow: value.lookbackWindow,
        };

        try {
          if (isEditMode) {
            return await dashboardOrpc.automation.schedules.update.call({
              triggerId: editTrigger.id,
              ...schedulePayload,
            });
          }
          return await dashboardOrpc.automation.schedules.create.call(
            schedulePayload
          );
        } catch (error) {
          if (getOrpcErrorDataCode(error) === "DUPLICATE_TRIGGER") {
            throw new Error(t("dialog.alreadyExists"));
          }
          if (error instanceof Error && error.message) {
            throw error;
          }
          throw new Error(
            isEditMode
              ? tAutomationShared("failedToUpdateSchedule")
              : t("dialog.createFailed")
          );
        }
      },
      onSuccess: (data) => {
        toast.success(isEditMode ? t("dialog.updated") : t("dialog.added"));
        onSuccess?.(data.trigger);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );

  const form = useForm({
    defaultValues: getDefaultScheduleValues(
      editTrigger,
      presetId,
      presetValues
    ),
    validators: {
      onSubmit: scheduleFormSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const previousAutoNameRef = useRef("");
  const lastResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastResetKeyRef.current = null;
      return;
    }

    const resetKey =
      editTrigger?.id ??
      `create:${presetId ?? ""}:${JSON.stringify(presetValues ?? {})}`;
    if (lastResetKeyRef.current === resetKey) {
      return;
    }

    form.reset(getDefaultScheduleValues(editTrigger, presetId, presetValues));
    previousAutoNameRef.current = "";
    lastResetKeyRef.current = resetKey;
  }, [open, editTrigger, presetId, presetValues, form]);

  const outputType = useStore(form.store, (s) => s.values.outputType);
  const schedule = useStore(form.store, (s) => s.values.schedule);
  const { frequency, intervalDays } = schedule;

  useEffect(() => {
    const newAutoName = buildAutoScheduleName(
      { frequency, intervalDays },
      outputType,
      t
    );
    const currentName = form.state.values.name;
    if (
      currentName === previousAutoNameRef.current ||
      currentName.length === 0
    ) {
      form.setFieldValue("name", newAutoName);
    }
    previousAutoNameRef.current = newAutoName;
  }, [outputType, frequency, intervalDays, form, t]);

  const { data: integrationsResponse, isLoading: isLoadingRepos } = useQuery(
    dashboardOrpc.integrations.list.queryOptions({
      input: { organizationId },
      enabled: !!organizationId && open,
    })
  );

  const { data: brandResponse } = useQuery(
    dashboardOrpc.brand.voices.list.queryOptions({
      input: { organizationId },
      enabled: !!organizationId && open,
    })
  );

  const brandVoices = brandResponse?.voices ?? [];
  const nonDefaultBrandVoices = brandVoices.filter((voice) => !voice.isDefault);
  const defaultBrandVoice = brandVoices.find((voice) => voice.isDefault);
  const defaultBrandVoiceLabel = defaultBrandVoice
    ? t("dialog.defaultVoiceName", { name: defaultBrandVoice.name })
    : t("dialog.defaultVoice");

  const { integrationOptions, githubIntegrationId } = useMemo(() => {
    const githubIntegrations =
      integrationsResponse?.integrations.filter(
        (i) => i.type === "github" && i.enabled
      ) ?? [];
    const linearIntegrations =
      integrationsResponse?.integrations.filter(
        (i) => i.type === "linear" && i.enabled
      ) ?? [];
    const repos = githubIntegrations.flatMap((i) =>
      i.repositories.filter((r) => r.enabled)
    );

    const options: SourceOption[] = [
      ...repos.map((r) => {
        const name = `${r.owner}/${r.repo}`;
        return {
          value: r.id,
          name,
          label: r.defaultBranch ? `${name} · ${r.defaultBranch}` : name,
          type: "github" as const,
        };
      }),
      ...linearIntegrations.map((i) => ({
        value: `linear:${i.id}`,
        name: i.displayName,
        label: i.displayName,
        type: "linear" as const,
      })),
    ];

    return {
      integrationOptions: options,
      githubIntegrationId: githubIntegrations[0]?.id,
    };
  }, [integrationsResponse]);

  const handleFrequencyChange = (next: ScheduleCron["frequency"]) => {
    const prev = form.state.values.schedule;
    let dayOfWeek: number | undefined;
    let dayOfMonth: number | undefined;
    let intervalDays: number | undefined;
    let anchorDate: string | undefined;
    if (next === "weekly") {
      dayOfWeek = prev.dayOfWeek ?? 1;
    } else if (next === "monthly") {
      dayOfMonth = prev.dayOfMonth ?? 1;
    } else if (next === "custom") {
      intervalDays = prev.intervalDays ?? CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS;
      anchorDate = prev.anchorDate ?? toUtcDateString(new Date());
    }
    form.setFieldValue("schedule", {
      ...prev,
      frequency: next,
      dayOfWeek,
      dayOfMonth,
      intervalDays,
      anchorDate,
    });
  };

  const formError = useStore(form.store, (state) => {
    if (state.submissionAttempts === 0) {
      return null;
    }
    for (const meta of Object.values(state.fieldMeta)) {
      const errors = meta?.errors;
      if (errors && errors.length > 0) {
        const first = errors[0];
        if (typeof first === "string") {
          return first;
        }
        if (first && typeof first === "object" && "message" in first) {
          const message = (first as { message: unknown }).message;
          if (typeof message === "string") {
            return message;
          }
        }
      }
    }
    return null;
  });

  let sources = (
    <form.Field name="repositoryIds">
      {(field) => (
        <SourcePicker
          ariaLabel={tCommon("labels.sources")}
          emptyLabel={t("dialog.noIntegrationsFound")}
          invalid={field.state.meta.errors.length > 0}
          onChange={field.handleChange}
          options={integrationOptions}
          placeholder={t("dialog.pickSources")}
          searchPlaceholder={t("dialog.searchIntegrations")}
          value={field.state.value}
        />
      )}
    </form.Field>
  );
  if (isLoadingRepos) {
    sources = <Skeleton className="h-8 w-40 rounded-lg" />;
  } else if (integrationOptions.length === 0) {
    sources = (
      <button
        className={PICKER_CHIP_CLASS}
        onClick={() => setAddRepoOpen(true)}
        type="button"
      >
        <HugeiconsIcon className="size-3.5" icon={Add01Icon} />
        {t("dialog.connectSource")}
      </button>
    );
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <EditorHeader
              enabled={enabled}
              kind="schedule"
              maxLength={MAX_SCHEDULE_NAME_LENGTH}
              name={field.state.value}
              onEnabledChange={setEnabled}
              onNameChange={field.handleChange}
              placeholder={buildAutoScheduleName(
                { frequency, intervalDays },
                outputType,
                t
              )}
            />
          )}
        </form.Field>

        <EditorSection
          hint={t("dialog.scheduleHint")}
          label={tCommon("labels.schedule")}
        >
          <EditorBox>
            <EditorPad>
              <ScheduleTriggerRow
                onDayOfMonthChange={(day) =>
                  form.setFieldValue("schedule.dayOfMonth", day)
                }
                onDayOfWeekChange={(day) =>
                  form.setFieldValue("schedule.dayOfWeek", day)
                }
                onFrequencyChange={handleFrequencyChange}
                onIntervalDaysChange={(days) =>
                  form.setFieldValue("schedule.intervalDays", days)
                }
                onTimeChange={(nextHour, nextMinute) => {
                  form.setFieldValue("schedule.hour", nextHour);
                  form.setFieldValue("schedule.minute", nextMinute);
                }}
                schedule={schedule}
              />
            </EditorPad>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {t("dialog.sentence.draft")}
              </span>
              <form.Field name="outputType">
                {(field) => (
                  <PickerSelect
                    ariaLabel={t("dialog.contentFormat")}
                    onChange={(next) =>
                      field.handleChange(next as ScheduleOutputType)
                    }
                    options={FORMAT_ORDER.map((type) => ({
                      value: type,
                      label: tCommon(`labels.${OUTPUT_TYPE_LABEL_KEYS[type]}`),
                    }))}
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <span className="text-muted-foreground">
                {t("dialog.sentence.from")}
              </span>
              {sources}
            </div>
            {kindPicker}
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint={t("dialog.instructionsHint")}
          label={t("dialog.instructions")}
        >
          <EditorBox>
            <EditorPad>
              <form.Field name="instructions">
                {(field) => (
                  <div className="space-y-2">
                    <textarea
                      aria-label={t("dialog.instructions")}
                      className="placeholder:text-muted-foreground/70 max-h-80 min-h-16 w-full resize-none overflow-y-auto bg-transparent text-sm outline-none"
                      id={field.name}
                      maxLength={MAX_SCHEDULE_INSTRUCTIONS_LENGTH}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      placeholder={t("dialog.instructionsPlaceholder")}
                      value={field.state.value}
                    />
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>{t("dialog.instructionsFooter")}</span>
                      <span className="tabular-nums">
                        {field.state.value.length} /{" "}
                        {MAX_SCHEDULE_INSTRUCTIONS_LENGTH}
                      </span>
                    </div>
                  </div>
                )}
              </form.Field>
            </EditorPad>
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint={t("dialog.rulesHint")}
          label={t("dialog.rules", {
            type: tCommon(`labels.${OUTPUT_TYPE_LABEL_KEYS[outputType]}`),
          })}
        >
          <EditorBox>
            <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm font-medium">
                {tCommon("labels.lookbackWindow")}
              </span>
              <form.Field name="lookbackWindow">
                {(field) => (
                  <PickerSelect
                    ariaLabel={tCommon("labels.lookbackWindow")}
                    onChange={(next) =>
                      field.handleChange(next as LookbackWindow)
                    }
                    options={LOOKBACK_WINDOWS.map((window) => ({
                      value: window,
                      label: lookbackLabel(window),
                    }))}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </div>
            {brandVoices.length > 1 && (
              <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm font-medium">
                  {tCommon("labels.brandVoice")}
                </span>
                <form.Field name="brandVoiceId">
                  {(field) => (
                    <PickerSelect
                      ariaLabel={tCommon("labels.brandVoice")}
                      onChange={field.handleChange}
                      options={[
                        { value: "", label: defaultBrandVoiceLabel },
                        ...nonDefaultBrandVoices.map((voice) => ({
                          value: voice.id,
                          label: voice.name,
                        })),
                      ]}
                      value={field.state.value}
                    />
                  )}
                </form.Field>
              </div>
            )}
            {supportsAutoPublish(outputType) && (
              <form.Field name="autoPublish">
                {(field) => (
                  <TriggerSwitchRow
                    checked={field.state.value}
                    id={field.name}
                    label={t("dialog.autoPublish")}
                    onCheckedChange={field.handleChange}
                    tooltip={t("dialog.autoPublishHint")}
                  />
                )}
              </form.Field>
            )}
          </EditorBox>
        </EditorSection>

        <form.Field name="notify">
          {(field) => (
            <AutomationNotifySection
              onChange={field.handleChange}
              organizationId={organizationId}
              value={field.state.value}
            />
          )}
        </form.Field>

        <EditorFooter
          status={
            formError ? (
              <span className="text-destructive flex items-center gap-1.5 font-medium">
                <HugeiconsIcon className="size-3.5" icon={AlertCircleIcon} />
                {formError}
              </span>
            ) : null
          }
        >
          <Button
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={mutation.isPending} type="submit">
            <HugeiconsIcon
              className="size-4"
              icon={isEditMode ? Tick02Icon : Add01Icon}
            />
            {isEditMode ? tCommon("actions.saveChanges") : t("dialog.add")}
          </Button>
        </EditorFooter>
      </form>
      {githubIntegrationId ? (
        <AddRepositoryDialog
          integrationId={githubIntegrationId}
          onOpenChange={(isOpen) => {
            setAddRepoOpen(isOpen);
          }}
          open={addRepoOpen}
          organizationId={organizationId}
        />
      ) : (
        <AddIntegrationDialog
          onOpenChange={(isOpen) => {
            setAddRepoOpen(isOpen);
          }}
          open={addRepoOpen}
          organizationId={organizationId}
        />
      )}
    </>
  );
}
