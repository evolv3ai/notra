"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { FieldError } from "@notra/ui/components/ui/field";
import {
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteCreateBulkFields } from "@/components/sites/site-create-bulk-fields";
import { SiteCreateBulkResults } from "@/components/sites/site-create-bulk-results";
import { SiteCreateBulkToggle } from "@/components/sites/site-create-bulk-toggle";
import { SiteCreateDeploy } from "@/components/sites/site-create-deploy";
import { SiteCreateProject } from "@/components/sites/site-create-project";
import { SiteCreateSourceFields } from "@/components/sites/site-create-source-fields";
import { SiteCreateStage } from "@/components/sites/site-create-stage";
import { SiteCreateStep } from "@/components/sites/site-create-step";
import { SiteCreateStepList } from "@/components/sites/site-create-step-list";
import { SiteImportList } from "@/components/sites/site-import-list";
import {
  SITE_CREATE_CONFIG_VARIANTS,
  SITE_CREATE_FIELD_INPUT_SUFFIXES,
  SITE_CREATE_FOCUS_DELAY_MS,
  SITE_CREATE_FORM_DEFAULTS,
  SITE_CREATE_STEP_IDS,
  SITE_CREATE_VALUE_FIELDS,
} from "@/constants/site-create";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useCreateSite } from "@/lib/hooks/use-create-site";
import { useCreateSites } from "@/lib/hooks/use-create-sites";
import {
  useConnectSiteRepository,
  useImportableRepositories,
} from "@/lib/hooks/use-importable-repositories";
import { useRepositorySuggestions } from "@/lib/hooks/use-repository-suggestions";
import { useSiteBulkImport } from "@/lib/hooks/use-site-bulk-import";
import type {
  SiteCreateFormProps,
  SiteCreateStepState,
} from "@/types/components/sites";
import type {
  SiteBulkRow,
  SiteCreateFieldErrors,
  SiteCreateFormValues,
  SiteCreateStepId,
  SiteImportableRepository,
  SiteRepository,
} from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import {
  hasSiteCreateSection,
  isSiteCreateReady,
  isSiteCreateSlugInvalid,
  siteCreateErrorField,
  siteCreateInput,
  siteCreateSectionPlan,
  withSiteRepository,
} from "@/utils/site-create";
import { siteBulkCreateInput, siteBulkFieldId } from "@/utils/site-create-bulk";
import { resolvedSiteProjectId } from "@/utils/site-project";

export function SiteCreateForm({
  organizationId,
  organizationSlug,
  hostingDomain,
}: SiteCreateFormProps) {
  const t = useTranslations("sites.new");
  const id = useId();
  const reduceMotion = useReducedMotion();

  const importable = useImportableRepositories(organizationId);
  const connect = useConnectSiteRepository(organizationId);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [repository, setRepository] = useState<SiteRepository | null>(null);
  const [activeStep, setActiveStep] = useState<SiteCreateStepId>("repository");
  const [form, setForm] = useState<SiteCreateFormValues>(
    SITE_CREATE_FORM_DEFAULTS
  );
  const [errors, setErrors] = useState<SiteCreateFieldErrors>({});
  const [starterPullRequestUrl, setStarterPullRequestUrl] = useState<
    string | null
  >(null);
  const sourceRevision = useRef(0);
  const resetStarterSource = () => {
    sourceRevision.current += 1;
    setStarterPullRequestUrl(null);
  };
  const startStarterRequest = () => {
    const revision = sourceRevision.current;
    return (url: string) => {
      if (sourceRevision.current === revision) {
        setStarterPullRequestUrl(url);
      }
    };
  };

  const projectId = resolvedSiteProjectId(useActiveProject());
  const createMutation = useCreateSite();
  const isCreating = createMutation.isPending;
  const created = createMutation.data?.site ?? null;
  const suggestions = useRepositorySuggestions({
    organizationId,
    repositoryId: form.repositoryId,
    branch: form.branch.trim(),
  });
  const sections = siteCreateSectionPlan(form, suggestions.contentCounts);
  const bulk = useSiteBulkImport({
    repository,
    branch: form.branch.trim(),
    suggestions,
  });
  const createManyMutation = useCreateSites();
  const isBulk = bulk.active;
  const isAnyCreating = isCreating || createManyMutation.isPending;
  const bulkLocked = bulk.createdCount > 0 || isAnyCreating;
  const isReady =
    Boolean(projectId) &&
    !suggestions.isLoading &&
    (isBulk
      ? repository !== null && bulk.isReady
      : isSiteCreateReady(form, repository) && hasSiteCreateSection(sections));
  const isSubmitting = isBulk ? createManyMutation.isPending : isCreating;
  const firstPendingRow = bulk.pendingRows[0];
  let configureFocusId = `${id}-name`;
  if (isBulk) {
    configureFocusId =
      bulkLocked && firstPendingRow
        ? siteBulkFieldId(id, firstPendingRow.rootDirectory, "name")
        : `${id}-bulk`;
  }

  const activeIndex = SITE_CREATE_STEP_IDS.indexOf(activeStep);
  const stateOf = (step: SiteCreateStepId): SiteCreateStepState => {
    if (step === "configure" && !repository) {
      return "locked";
    }
    const index = SITE_CREATE_STEP_IDS.indexOf(step);
    if (index === activeIndex) {
      return "active";
    }
    return index < activeIndex ? "done" : "locked";
  };

  const clearErrors = (fields: (keyof SiteCreateFieldErrors)[]) =>
    setErrors((current) => {
      const next = { ...current };
      for (const field of fields) {
        delete next[field];
      }
      return next;
    });

  const update = <K extends keyof SiteCreateFormValues>(
    key: K,
    value: SiteCreateFormValues[K]
  ) => {
    if (key === "repositoryId" || key === "branch" || key === "rootDirectory") {
      resetStarterSource();
    }
    setForm((current) => ({ ...current, [key]: value }));
    const field = SITE_CREATE_VALUE_FIELDS[key];
    if (field) {
      clearErrors(
        key === "name" && !form.slug.trim() ? [field, "slug"] : [field]
      );
    }
  };

  const goTo = (step: SiteCreateStepId, focusId?: string) => {
    const bulkBlocks =
      bulkLocked && (step === "repository" || bulk.pendingRows.length === 0);
    if (step !== "deploy" && (createMutation.isSuccess || bulkBlocks)) {
      return;
    }
    setActiveStep(step);
    if (focusId) {
      window.setTimeout(
        () => document.getElementById(focusId)?.focus({ preventScroll: true }),
        reduceMotion ? 0 : SITE_CREATE_FOCUS_DELAY_MS
      );
    }
  };

  const importRepository = async (candidate: SiteImportableRepository) => {
    setImportingId(candidate.githubRepositoryId);
    try {
      const picked: SiteRepository = candidate.integrationId
        ? {
            id: candidate.integrationId,
            owner: candidate.owner,
            repo: candidate.repo,
            defaultBranch: candidate.defaultBranch,
            private: candidate.private,
          }
        : await connect.mutateAsync(candidate.githubRepositoryId);
      setRepository(picked);
      resetStarterSource();
      setForm((current) =>
        withSiteRepository({ ...current, name: "", slug: "" }, picked)
      );
      clearErrors(["repository"]);
      goTo("configure", `${id}-name`);
    } catch (error) {
      toast.error(toErrorMessage(error, t("importFailed")));
    }
    setImportingId(null);
  };

  const create = () => {
    if (isBulk) {
      if (isReady) {
        createBulk(bulk.selectedRows);
      }
      return;
    }
    if (!(repository && isReady && projectId) || isAnyCreating) {
      return;
    }
    createMutation.mutate(
      siteCreateInput(form, sections, {
        organizationId,
        repositoryId: repository.id,
        projectId,
      }),
      {
        onSuccess: () => goTo("deploy"),
        onError: (error) => {
          const field = siteCreateErrorField(error);
          if (!field) {
            return;
          }
          setErrors({ [field]: error.message });
          if (field === "repository") {
            goTo("repository");
            return;
          }
          const suffix = SITE_CREATE_FIELD_INPUT_SUFFIXES[field];
          goTo("configure", suffix ? `${id}-${suffix}` : undefined);
        },
      }
    );
  };

  const createBulk = (rows: SiteBulkRow[]) => {
    if (!(repository && projectId) || rows.length === 0 || isAnyCreating) {
      return;
    }
    createManyMutation.mutate(
      siteBulkCreateInput(
        rows,
        { organizationId, repositoryId: repository.id, projectId },
        { branch: form.branch, previewsEnabled: bulk.previewsEnabled }
      ),
      {
        onSuccess: ({ results }) => {
          bulk.recordResults(rows, results);
          goTo("deploy");
        },
      }
    );
  };

  const retryFailedBulkRows = () =>
    createBulk(
      bulk.submittedRows.filter((row) => row.result && "error" in row.result)
    );

  const steps = SITE_CREATE_STEP_IDS.map((step) => ({
    id: step,
    label: t(`stepLabels.${step}`),
    state: stateOf(step),
  }));
  const configureDescription = repository
    ? t("stepConfigureDescription", {
        repository: `${repository.owner}/${repository.repo}`,
      })
    : undefined;
  const sideTitle = {
    repository: {
      title: t("stepRepository"),
      description: t("stepRepositoryDescription"),
    },
    configure: {
      title: t("stepConfigure"),
      description: configureDescription,
    },
    deploy: {
      title: t("stepDeploy"),
      description: t("stepDeployDescription"),
    },
  }[activeStep];

  let deployContent = <div className="h-80" />;
  if (isBulk && bulk.submittedRows.length > 0) {
    deployContent = (
      <SiteCreateBulkResults
        isRetrying={createManyMutation.isPending}
        onEdit={() => goTo("configure", configureFocusId)}
        onRetry={retryFailedBulkRows}
        organizationSlug={organizationSlug}
        rows={bulk.submittedRows}
      />
    );
  } else if (created) {
    deployContent = (
      <SiteCreateDeploy
        deploymentQueued={createMutation.data?.deploymentQueued ?? true}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        site={created}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6" data-site-fill>
      <PageHeading description={t("description")} title={t("title")} />
      <SiteCreateProject organizationId={organizationId} />
      <div className="flex min-h-[32rem] min-w-0 flex-1 flex-col">
        <SiteCreateStage
          activeIndex={activeIndex}
          left={
            <div
              aria-hidden="true"
              className="animate-in fade-in motion-safe:slide-in-from-bottom-1 space-y-1.5 pt-1 duration-500"
              key={activeStep}
            >
              <p className="text-lg font-semibold tracking-tight">
                {sideTitle.title}
              </p>
              {sideTitle.description ? (
                <p className="text-muted-foreground text-sm text-pretty">
                  {sideTitle.description}
                </p>
              ) : null}
            </div>
          }
          right={
            <SiteCreateStepList onSelect={(step) => goTo(step)} steps={steps} />
          }
        >
          <SiteCreateStep
            description={t("stepRepositoryDescription")}
            onActivate={() => goTo("repository")}
            state={stateOf("repository")}
            title={t("stepRepository")}
          >
            <SiteImportList
              importingId={importingId}
              installed={importable.data?.installed ?? false}
              isLoading={importable.isPending}
              loadFailed={importable.isError}
              onImport={importRepository}
              onRetry={() => importable.refetch()}
              organizationId={organizationId}
              organizationSlug={organizationSlug}
              repositories={importable.data?.repositories ?? []}
            />
            <FieldError className="mt-3">{errors.repository}</FieldError>
          </SiteCreateStep>

          <SiteCreateStep
            description={configureDescription}
            footer={
              <Button
                disabled={!isReady}
                loading={isSubmitting}
                onClick={create}
                type="button"
              >
                {isBulk
                  ? t("bulk.create", { count: bulk.selectedRows.length })
                  : t("create")}
              </Button>
            }
            onActivate={() => goTo("configure", configureFocusId)}
            state={stateOf("configure")}
            title={t("stepConfigure")}
          >
            <MotionConfig reducedMotion="user">
              <LazyMotion features={domAnimation} strict>
                <m.div
                  animate="shown"
                  className="space-y-4"
                  initial={repository ? "hidden" : false}
                  key={repository?.id ?? "locked"}
                  variants={SITE_CREATE_CONFIG_VARIANTS}
                >
                  {bulk.available ? (
                    <SiteCreateBulkToggle
                      checked={isBulk}
                      count={bulk.rows.length}
                      disabled={bulkLocked}
                      id={`${id}-bulk`}
                      onCheckedChange={bulk.setEnabled}
                    />
                  ) : null}
                  {isBulk ? (
                    <SiteCreateBulkFields
                      branch={form.branch}
                      branchLocked={bulkLocked}
                      hostingDomain={hostingDomain}
                      idPrefix={id}
                      issues={bulk.issues}
                      onBranchChange={(value) => update("branch", value)}
                      onPreviewsChange={bulk.setPreviewsEnabled}
                      onRowChange={bulk.updateRow}
                      onSelectAll={bulk.selectAll}
                      disabled={createManyMutation.isPending}
                      previewsEnabled={bulk.previewsEnabled}
                      repository={repository}
                      rows={bulk.pendingRows}
                      suggestions={suggestions}
                    />
                  ) : (
                    <SiteCreateSourceFields
                      errors={errors}
                      form={form}
                      hostingDomain={hostingDomain}
                      idPrefix={id}
                      onChange={update}
                      onStarterRequestStart={startStarterRequest}
                      organizationId={organizationId}
                      repository={repository}
                      sections={sections}
                      slugInvalid={isSiteCreateSlugInvalid(form)}
                      starterPullRequestUrl={starterPullRequestUrl}
                      suggestions={suggestions}
                    />
                  )}
                </m.div>
              </LazyMotion>
            </MotionConfig>
          </SiteCreateStep>

          <SiteCreateStep state={stateOf("deploy")} title={t("stepDeploy")}>
            {deployContent}
          </SiteCreateStep>
        </SiteCreateStage>
      </div>
    </div>
  );
}
