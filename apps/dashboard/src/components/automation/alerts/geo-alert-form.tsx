"use client";

import {
  Add01Icon,
  Layers01Icon,
  SentIcon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  GEO_ALERT_DEFAULT_THRESHOLDS,
  GEO_ALERT_MAX_THRESHOLD,
  GEO_ALERT_SIGNALS,
  type GeoAlertActions,
  type GeoAlertSignal,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import { MAX_SCHEDULE_NAME_LENGTH } from "@notra/schemas/dashboard/integrations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { NumberField } from "@notra/ui/components/ui/number-field";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { GeoAlertDestinationsSection } from "@/components/automation/alerts/geo-alert-destinations";
import {
  EditorBox,
  EditorFooter,
  EditorHeader,
  EditorPad,
  EditorSection,
  PickerSelect,
} from "@/components/automation/editor/editor-parts";
import { Button } from "@/components/button";
import { ProjectLogo } from "@/components/geo/project-logo";
import { AUTOMATION_TEMPLATES } from "@/constants/automation-templates";
import { useInvalidateAutomationRuns } from "@/lib/hooks/use-automation-runs";
import { useBrandSettings } from "@/lib/hooks/use-brand-analysis";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { GeoAlertFormProps } from "@/types/automation/geo-alerts";
import { getWebsiteDomain } from "@/utils/brand";
import { resolveGeoAlertFormActions } from "@/utils/geo-alert-form";
import { getOrpcErrorDataCode } from "@/utils/orpc-errors";

const ALL_PROJECTS = "all";

function signalIcon(signal: GeoAlertSignal): IconSvgElement {
  const template = AUTOMATION_TEMPLATES.find(
    (item) => item.kind === "alert" && item.signal === signal
  );
  return template?.icon ?? SentIcon;
}

export function GeoAlertForm(props: GeoAlertFormProps) {
  if (!props.open) {
    return null;
  }
  // Refetching the same alert must not reset a dirty form. Only a different
  // alert, organization, preset, or reopening starts a new editing session.
  const key = JSON.stringify([
    props.organizationId,
    props.editAlert?.id,
    props.preset?.signal,
    props.preset?.actions?.slack,
    props.preset?.actions?.email,
    props.preset?.actions?.webhook,
  ]);
  return <GeoAlertEditor {...props} key={key} />;
}

function GeoAlertEditor({
  organizationId,
  organizationSlug,
  onOpenChange,
  editAlert,
  preset,
  onSaved,
  kindPicker,
}: GeoAlertFormProps) {
  const t = useTranslations("automation.alerts");
  const tCommon = useTranslations("common");
  const { projects } = useGeoProjectsDb(organizationId);

  const destinationsQuery = useQuery(
    dashboardOrpc.automation.alerts.destinations.queryOptions({
      input: { organizationId },
      enabled: !!organizationId,
    })
  );

  const { data: destinations } = destinationsQuery;
  const initialSignal =
    editAlert?.sourceConfig.signal ?? preset?.signal ?? "visibility_drop";
  const [signal, setSignal] = useState<GeoAlertSignal>(initialSignal);
  const [threshold, setThreshold] = useState<number | undefined>(() =>
    editAlert
      ? editAlert.sourceConfig.threshold
      : GEO_ALERT_DEFAULT_THRESHOLDS[initialSignal]
  );
  const [projectId, setProjectId] = useState(
    editAlert?.sourceConfig.projectId ?? ALL_PROJECTS
  );
  const [selection, setSelection] = useState<Partial<GeoAlertActions>>(
    () => editAlert?.actions ?? preset?.actions ?? {}
  );
  const actions = resolveGeoAlertFormActions(selection, destinations);
  const [name, setName] = useState(editAlert?.name ?? "");
  const [nameTouched, setNameTouched] = useState(!!editAlert);
  const [enabled, setEnabled] = useState(editAlert?.enabled ?? true);

  const defaultName = t(`signals.${signal}.label`);
  const resolvedName = (nameTouched ? name : defaultName).trim();
  const hasThreshold = GEO_ALERT_DEFAULT_THRESHOLDS[signal] !== undefined;
  const hasAction = actions.slack || actions.email || actions.webhook;
  const canSave = hasAction && destinationsQuery.isSuccess;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        organizationId,
        name: resolvedName || defaultName,
        sourceConfig: {
          signal,
          projectId: projectId === ALL_PROJECTS ? null : projectId,
          ...(hasThreshold && threshold ? { threshold } : {}),
        },
        actions,
        enabled,
      };
      try {
        return editAlert
          ? await dashboardOrpc.automation.alerts.update.call({
              ...body,
              triggerId: editAlert.id,
            })
          : await dashboardOrpc.automation.alerts.create.call(body);
      } catch (error) {
        if (getOrpcErrorDataCode(error) === "DUPLICATE_TRIGGER") {
          throw new Error(t("dialog.duplicate"));
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(editAlert ? t("dialog.updated") : t("dialog.created"));
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("dialog.failed"));
    },
  });

  const invalidateRuns = useInvalidateAutomationRuns();
  const sendTest = useMutation({
    mutationFn: () => {
      if (!editAlert) {
        throw new Error(t("dialog.failed"));
      }
      return dashboardOrpc.automation.alerts.sendTest.call({
        organizationId,
        triggerId: editAlert.id,
      });
    },
    onSuccess: ({ delivery }) => {
      const delivered = Object.values(delivery).some(Boolean);
      if (delivered) {
        toast.success(t("dialog.testSent"));
      } else {
        toast.error(t("dialog.testFailed"));
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("dialog.testFailed")
      );
    },
    onSettled: invalidateRuns,
  });

  const toggleAction = (key: keyof GeoAlertActions, value: boolean) =>
    setSelection((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          save.mutate();
        }
      }}
    >
      <EditorHeader
        enabled={enabled}
        kind="alert"
        maxLength={MAX_SCHEDULE_NAME_LENGTH}
        name={nameTouched ? name : defaultName}
        onEnabledChange={setEnabled}
        onNameChange={(value) => {
          setNameTouched(true);
          setName(value);
        }}
        placeholder={defaultName}
      />

      <EditorSection hint={t("dialog.triggerHint")} label={t("dialog.trigger")}>
        <EditorBox>
          <EditorPad>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PickerSelect
                ariaLabel={t("dialog.signal")}
                onChange={(value) => {
                  const next = value as GeoAlertSignal;
                  setSignal(next);
                  setThreshold(GEO_ALERT_DEFAULT_THRESHOLDS[next]);
                }}
                options={GEO_ALERT_SIGNALS.map((item) => ({
                  value: item,
                  label: t(`signals.${item}.label`),
                  icon: signalIcon(item),
                }))}
                value={signal}
              />

              {hasThreshold ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  {t("dialog.atLeast")}
                  <NumberField
                    aria-label={t(`signals.${signal}.unit`)}
                    decrementLabel={t("dialog.decrease")}
                    incrementLabel={t("dialog.increase")}
                    max={GEO_ALERT_MAX_THRESHOLD}
                    min={1}
                    onValueChange={(value) => setThreshold(value ?? undefined)}
                    value={threshold ?? null}
                  />
                  {t(`signals.${signal}.unit`)}
                </div>
              ) : null}

              {projects.length > 1 ? (
                <div className="ml-auto">
                  <ProjectScopeSelect
                    onChange={setProjectId}
                    organizationId={organizationId}
                    projects={projects}
                    value={projectId}
                  />
                </div>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs text-pretty">
              {t(`signals.${signal}.description`)}{" "}
              {signal === "scan_failed"
                ? t("dialog.runsOnFailure")
                : t("dialog.runsAfterScan")}
            </p>
          </EditorPad>
          {kindPicker}
        </EditorBox>
      </EditorSection>

      <GeoAlertDestinationsSection
        actions={actions}
        destinations={destinations}
        loadFailed={destinationsQuery.isError}
        onRetry={() => destinationsQuery.refetch()}
        onToggle={toggleAction}
        retrying={destinationsQuery.isFetching}
        organizationSlug={organizationSlug}
      />

      <EditorFooter
        start={
          editAlert ? (
            <Button
              loading={sendTest.isPending}
              onClick={() => sendTest.mutate()}
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon className="size-4" icon={SentIcon} />
              {t("dialog.sendTest")}
            </Button>
          ) : undefined
        }
        status={
          hasAction ||
          destinationsQuery.isPending ||
          destinationsQuery.isError ? null : (
            // Guidance, not an error: the user only switched things off, and
            // the disabled button already blocks saving.
            <span className="text-muted-foreground">
              {t("dialog.pickDestination")}
            </span>
          )
        }
      >
        <Button
          onClick={() => onOpenChange(false)}
          type="button"
          variant="outline"
        >
          {tCommon("actions.cancel")}
        </Button>
        <Button disabled={!canSave} loading={save.isPending} type="submit">
          <HugeiconsIcon
            className="size-4"
            icon={editAlert ? Tick02Icon : Add01Icon}
          />
          {editAlert ? tCommon("actions.saveChanges") : t("dialog.create")}
        </Button>
      </EditorFooter>
    </form>
  );
}

function ProjectScopeSelect({
  organizationId,
  projects,
  value,
  onChange,
}: {
  organizationId: string;
  projects: { id: string; name: string; brandSettingsId: string }[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  const t = useTranslations("automation.alerts.dialog");
  const tCommon = useTranslations("common");
  const { data: brandData } = useBrandSettings(organizationId);
  const domainOf = (brandSettingsId: string) =>
    getWebsiteDomain(
      brandData?.voices.find((voice) => voice.id === brandSettingsId)
        ?.websiteUrl ?? null
    );
  const selected = projects.find((project) => project.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t("project")} size="sm" variant="outline" />
        }
      >
        {selected ? (
          <ProjectLogo
            domain={domainOf(selected.brandSettingsId)}
            name={selected.name}
          />
        ) : (
          <HugeiconsIcon className="size-4" icon={Layers01Icon} />
        )}
        <span className="max-w-40 truncate">
          {selected?.name ?? t("allProjects")}
        </span>
        <HugeiconsIcon
          className="text-muted-foreground size-4"
          icon={UnfoldMoreIcon}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tCommon("labels.projects")}</DropdownMenuLabel>
          <DropdownMenuItem
            className="cursor-pointer gap-2 pr-8"
            onClick={() => onChange(ALL_PROJECTS)}
          >
            <HugeiconsIcon className="size-4" icon={Layers01Icon} />
            <span className="min-w-0 flex-1 truncate">{t("allProjects")}</span>
            {value === ALL_PROJECTS ? (
              <HugeiconsIcon
                className="text-muted-foreground absolute right-2 size-4"
                icon={Tick02Icon}
              />
            ) : null}
          </DropdownMenuItem>
          {projects.map((project) => (
            <DropdownMenuItem
              className="cursor-pointer gap-2 pr-8"
              key={project.id}
              onClick={() => onChange(project.id)}
            >
              <ProjectLogo
                domain={domainOf(project.brandSettingsId)}
                name={project.name}
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {value === project.id ? (
                <HugeiconsIcon
                  className="text-muted-foreground absolute right-2 size-4"
                  icon={Tick02Icon}
                />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
