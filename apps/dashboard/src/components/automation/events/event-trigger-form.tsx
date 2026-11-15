"use client";

import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { EditorHeader } from "@/components/automation/editor/editor-parts";
import { AutomationNotifySection } from "@/components/automation/editor/notify-section";
import { useEventTriggerForm } from "@/lib/hooks/use-event-trigger-form";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { EventTriggerFormProps } from "@/types/automation/event-trigger";

import { EventTriggerDialogFooter } from "./event-trigger-dialog-footer";
import { EventTriggerRulesSection } from "./event-trigger-rules-section";
import { EventTriggerSection } from "./event-trigger-section";
import { RepositoryConnectionDialogs } from "./repository-connection-dialogs";

export function EventTriggerForm({
  organizationId,
  onSuccess,
  editTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  preset,
  kindPicker,
}: EventTriggerFormProps) {
  const t = useTranslations("automation.events.dialog");
  const isEditMode = !!editTrigger;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [enabled, setEnabled] = useState(editTrigger?.enabled ?? true);

  const { form, isPending } = useEventTriggerForm({
    organizationId,
    editTrigger,
    enabled,
    open,
    preset,
    onSuccess,
    onClose: () => setOpen(false),
  });

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

  const githubIntegrations =
    integrationsResponse?.integrations.filter(
      (integration) => integration.type === "github" && integration.enabled
    ) ?? [];
  const repos = githubIntegrations.flatMap((integration) =>
    integration.repositories.filter((repository) => repository.enabled)
  );
  const integrationOptions = repos.map((repository) => {
    const name = `${repository.owner}/${repository.repo}`;
    return {
      value: repository.id,
      name,
      type: "github" as const,
      label: repository.defaultBranch
        ? `${name} · ${repository.defaultBranch}`
        : name,
    };
  });
  const githubIntegrationId = githubIntegrations[0]?.id;

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

  const handleOpenAddRepoFlow = () => {
    setAddRepoOpen(true);
  };

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
        <EditorHeader
          enabled={enabled}
          kind="event"
          onEnabledChange={setEnabled}
          title={isEditMode ? t("editTitle") : t("newTitle")}
        />
        <EventTriggerSection
          form={form}
          isLoading={isLoadingRepos}
          kindPicker={kindPicker}
          onAddRepository={handleOpenAddRepoFlow}
          options={integrationOptions}
        />
        <EventTriggerRulesSection brandVoices={brandVoices} form={form} />
        <form.Field name="notify">
          {(field) => (
            <AutomationNotifySection
              onChange={field.handleChange}
              organizationId={organizationId}
              value={field.state.value}
            />
          )}
        </form.Field>
        <EventTriggerDialogFooter
          errorMessage={formError}
          isEditMode={isEditMode}
          isPending={isPending}
          onCancel={() => setOpen(false)}
        />
      </form>
      <RepositoryConnectionDialogs
        githubIntegrationId={githubIntegrationId}
        isEditMode={isEditMode}
        onOpenChange={(isOpen) => {
          setAddRepoOpen(isOpen);
        }}
        open={addRepoOpen}
        organizationId={organizationId}
      />
    </>
  );
}
