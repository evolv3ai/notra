"use client";

import {
  Analytics01Icon,
  ArrowUpRight01Icon,
  CodeIcon,
  Comment01Icon,
  FlashIcon,
  Folder01Icon,
  GitBranchIcon,
  GithubIcon,
  Layers01Icon,
  Route01Icon,
  SparklesIcon,
  Tag01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import { Field, FieldError, FieldLabel } from "@notra/ui/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@notra/ui/components/ui/input-group";
import { Switch } from "@notra/ui/components/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import { SiteImportList } from "@/components/sites/site-import-list";
import { SiteNameField } from "@/components/sites/site-name-field";
import { SitePreviewAccessRows } from "@/components/sites/site-preview-access-select";
import { SiteSettingsDangerZone } from "@/components/sites/site-settings-danger-zone";
import { SiteSettingsEditor } from "@/components/sites/site-settings-editor";
import {
  SiteSettingsGroup,
  SiteSettingsHint,
  SiteSettingsItem,
  SiteSettingsList,
  SiteSettingsSwitchItem,
  SiteSettingsValue,
} from "@/components/sites/site-settings-item";
import { SiteSuggestInput } from "@/components/sites/site-suggest-input";
import { SiteUpgradeDialog } from "@/components/sites/site-upgrade-dialog";
import {
  SiteVariablesCount,
  SiteVariablesSettings,
} from "@/components/sites/site-variables-settings";
import {
  useGitHubCallbackErrorToast,
  useResumeGitHubInstall,
} from "@/hooks/use-github-install-callbacks";
import {
  useConnectSiteRepository,
  useImportableRepositories,
} from "@/lib/hooks/use-importable-repositories";
import { useRepositorySuggestions } from "@/lib/hooks/use-repository-suggestions";
import { useInvalidateSites, useSitePlanUsage } from "@/lib/hooks/use-sites";
import { useUpdateSiteSettings } from "@/lib/hooks/use-update-site-settings";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteBranchFieldProps,
  SiteRootDirectoryFieldProps,
  SiteSectionFieldProps,
  SiteSettingsToggleProps,
} from "@/types/components/site-settings";
import type {
  SiteImportableRepository,
  SiteRepository,
  SiteSettingsRowKey,
} from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import {
  githubRepositoryUrl,
  hostFromOrigin,
  siteHref,
} from "@/utils/site-links";

export function SiteSettingsPage() {
  const { organizationId, organizationSlug, siteId } = useSite();
  useGitHubCallbackErrorToast();
  useResumeGitHubInstall({
    callbackPath: siteHref(organizationSlug, siteId, "settings"),
    organizationId,
  });
  return <SiteSettingsContent key={siteId} />;
}

function SiteSettingsContent() {
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const t = useTranslations("sites.settings");
  const tPage = useTranslations("sites.settingsPage");
  const tNew = useTranslations("sites.new");
  const tVariables = useTranslations("sites.variables");
  const tSections = useTranslations("sites.sections");
  const [openRow, setOpenRow] = useState<SiteSettingsRowKey | null>(null);
  const { site } = detail;

  const row = (key: SiteSettingsRowKey) => ({
    open: openRow === key,
    onOpenChange: (open: boolean) => setOpenRow(open ? key : null),
  });
  const closeRow = (key: SiteSettingsRowKey) => () =>
    setOpenRow((current) => (current === key ? null : current));

  return (
    <div className="space-y-8">
      <PageHeading description={tPage("description")} title={tPage("title")} />

      <SiteSettingsList>
        <SiteSettingsItem
          description={t("nameHint")}
          icon={Tag01Icon}
          title={tNew("name")}
          value={<SiteNameField />}
        />
        <SiteSettingsItem
          {...row("repository")}
          description={t("repositoryHint")}
          icon={GithubIcon}
          title={t("repository")}
          value={
            <SiteSettingsValue>
              {site.repository
                ? `${site.repository.owner}/${site.repository.name}`
                : t("noRepository")}
            </SiteSettingsValue>
          }
        >
          <RepositoryPanel onDone={closeRow("repository")} />
        </SiteSettingsItem>
        <SiteSettingsItem
          {...row("branch")}
          description={tNew("branchHint")}
          icon={GitBranchIcon}
          title={tNew("branch")}
          value={
            <SiteSettingsValue mono>{site.productionBranch}</SiteSettingsValue>
          }
        >
          <SiteSettingsEditor
            isValid={(form) => form.productionBranch.trim().length > 0}
            onDone={closeRow("branch")}
          >
            {(form, update) => (
              <BranchField
                onChange={(value) => update("productionBranch", value)}
                value={form.productionBranch}
              />
            )}
          </SiteSettingsEditor>
        </SiteSettingsItem>
        <SiteSettingsItem
          {...row("rootDirectory")}
          description={t("rootDirectoryHint")}
          icon={Folder01Icon}
          title={t("rootDirectory")}
          value={
            <SiteSettingsValue mono>
              {site.rootDirectory ? `./${site.rootDirectory}` : "./"}
            </SiteSettingsValue>
          }
        >
          <SiteSettingsEditor onDone={closeRow("rootDirectory")}>
            {(form, update) => (
              <RootDirectoryField
                branch={form.productionBranch}
                onChange={(value) => update("rootDirectory", value)}
                value={form.rootDirectory}
              />
            )}
          </SiteSettingsEditor>
        </SiteSettingsItem>
        <SiteSettingsToggle
          description={t("smartDeploymentsHint")}
          field="smartDeployments"
          icon={FlashIcon}
          title={
            <span className="inline-flex items-center gap-2">
              {t("smartDeployments")}
              <Badge size="sm" variant="secondary">
                {t("beta")}
              </Badge>
            </span>
          }
        />
      </SiteSettingsList>

      <SiteSettingsGroup icon={Layers01Icon} title={t("contentGroup")}>
        <SiteSettingsList>
          <SiteSettingsItem
            {...row("sections")}
            description={t("sectionsRowHint")}
            icon={Route01Icon}
            title={tSections("title")}
            value={
              <SiteSettingsValue mono>
                {[site.mounts.blog, site.mounts.changelog]
                  .filter(Boolean)
                  .join("  ·  ")}
              </SiteSettingsValue>
            }
          >
            <SiteSettingsEditor
              isValid={(form) => form.blogEnabled || form.changelogEnabled}
              onDone={closeRow("sections")}
            >
              {(form, update) => (
                <>
                  <div className="divide-y rounded-xl border">
                    <SiteSectionField
                      description={tSections("blogDescription")}
                      enabled={form.blogEnabled}
                      onEnabledChange={(value) => update("blogEnabled", value)}
                      onPathChange={(value) => update("blogPath", value)}
                      path={form.blogPath}
                      title={tSections("blog")}
                    />
                    <SiteSectionField
                      description={tSections("changelogDescription")}
                      enabled={form.changelogEnabled}
                      onEnabledChange={(value) =>
                        update("changelogEnabled", value)
                      }
                      onPathChange={(value) => update("changelogPath", value)}
                      path={form.changelogPath}
                      title={tSections("changelog")}
                    />
                  </div>
                  {form.blogEnabled || form.changelogEnabled ? (
                    <SiteSettingsHint>{tPage("sectionsHint")}</SiteSettingsHint>
                  ) : (
                    <FieldError>{tSections("atLeastOne")}</FieldError>
                  )}
                </>
              )}
            </SiteSettingsEditor>
          </SiteSettingsItem>
          <SiteSettingsItem
            {...row("variables")}
            description={t("variablesHint")}
            icon={CodeIcon}
            title={tVariables("title")}
            value={<SiteVariablesCount />}
          >
            <SiteVariablesSettings />
          </SiteSettingsItem>
        </SiteSettingsList>
      </SiteSettingsGroup>

      <SiteSettingsGroup icon={ViewIcon} title={t("previews")}>
        <SiteSettingsList>
          <SitePreviewAccessRows />
          <SiteSettingsToggle
            description={t("previewCommentsHint")}
            field="previewCommentsEnabled"
            icon={Comment01Icon}
            title={t("previewComments")}
          />
        </SiteSettingsList>
      </SiteSettingsGroup>

      <SiteSettingsGroup icon={Analytics01Icon} title={t("visitors")}>
        <SiteSettingsList>
          <SiteAnalyticsToggle />
          <SiteBrandingToggle />
        </SiteSettingsList>
      </SiteSettingsGroup>

      <SiteSettingsDangerZone
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        site={site}
        siteId={siteId}
      />
    </div>
  );
}

function RepositoryPanel({ onDone }: { onDone: () => void }) {
  const t = useTranslations("sites.settings");
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const { repository } = detail.site;
  const importable = useImportableRepositories(organizationId);
  const connect = useConnectSiteRepository(organizationId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [target, setTarget] = useState<SiteRepository | null>(null);
  const save = useUpdateSiteSettings({
    onSaved: () => {
      setTarget(null);
      onDone();
    },
  });
  const pick = async (candidate: SiteImportableRepository) => {
    setPendingId(candidate.githubRepositoryId);
    try {
      setTarget(
        candidate.integrationId
          ? {
              id: candidate.integrationId,
              owner: candidate.owner,
              repo: candidate.repo,
              defaultBranch: candidate.defaultBranch,
              private: candidate.private,
            }
          : await connect.mutateAsync(candidate.githubRepositoryId)
      );
    } catch (error) {
      toast.error(toErrorMessage(error, t("switchRepositoryFailed")));
    }
    setPendingId(null);
  };
  return (
    <div className="space-y-3">
      <SiteImportList
        actionAriaLabel={(name) => t("useRepository", { repository: name })}
        actionLabel={t("use")}
        callbackPath={siteHref(organizationSlug, siteId, "settings")}
        currentRepository={repository}
        importingId={pendingId}
        installed={importable.data?.installed ?? false}
        isLoading={importable.isPending}
        loadFailed={importable.isError}
        onImport={pick}
        onRetry={() => importable.refetch()}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        repositories={importable.data?.repositories ?? []}
      />
      {repository ? (
        <a
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href={githubRepositoryUrl(repository)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("openOnGitHub")}
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-end"
            icon={ArrowUpRight01Icon}
          />
        </a>
      ) : null}
      <ConfirmDialog
        confirmLabel={t("switchRepositoryConfirm")}
        description={t("switchRepositoryDescription", {
          branch: target?.defaultBranch || "main",
        })}
        onConfirm={() => {
          if (target) {
            save.mutate({ repositoryId: target.id });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
          }
        }}
        open={target !== null}
        pending={save.isPending}
        title={t("switchRepositoryTitle", {
          repository: target ? `${target.owner}/${target.repo}` : "",
        })}
      />
    </div>
  );
}

function BranchField({ value, onChange }: SiteBranchFieldProps) {
  const t = useTranslations("sites.settings");
  const tNew = useTranslations("sites.new");
  const { organizationId, siteId } = useSite();
  const id = useId();
  const suggestions = useRepositorySuggestions({
    organizationId,
    siteId,
    branch: value.trim(),
  });
  return (
    <Field>
      <FieldLabel htmlFor={id}>{tNew("branch")}</FieldLabel>
      <SiteSuggestInput
        emptyLabel={tNew("noBranchMatch")}
        icon={GitBranchIcon}
        id={id}
        onValueChange={onChange}
        suggestions={suggestions.branches}
        value={value}
      />
      <SiteSettingsHint>{t("branchFieldHint")}</SiteSettingsHint>
    </Field>
  );
}

function RootDirectoryField({
  value,
  branch,
  onChange,
}: SiteRootDirectoryFieldProps) {
  const t = useTranslations("sites.settings");
  const tNew = useTranslations("sites.new");
  const { organizationId, siteId } = useSite();
  const id = useId();
  const suggestions = useRepositorySuggestions({
    organizationId,
    siteId,
    branch: branch.trim(),
  });
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {t("rootDirectory")}
        <Badge size="sm" variant="outline">
          {t("optional")}
        </Badge>
      </FieldLabel>
      <SiteSuggestInput
        emptyLabel={tNew("noDirectoryMatch")}
        icon={Folder01Icon}
        id={id}
        onValueChange={onChange}
        placeholder={t("rootDirectoryPlaceholder")}
        suggestions={suggestions.configDirectories.filter(Boolean)}
        value={value}
      />
      <SiteSettingsHint>{t("rootDirectoryFieldHint")}</SiteSettingsHint>
    </Field>
  );
}

function SiteSectionField({
  title,
  description,
  enabled,
  path,
  onEnabledChange,
  onPathChange,
}: SiteSectionFieldProps) {
  const tSections = useTranslations("sites.sections");
  const { site } = useSite().detail;
  const id = useId();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,10rem)_minmax(0,1fr)]">
      <Switch
        checked={enabled}
        id={`${id}-enabled`}
        onCheckedChange={onEnabledChange}
        size="sm"
      />
      <label className="min-w-0 cursor-pointer" htmlFor={`${id}-enabled`}>
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {description}
        </span>
      </label>
      <InputGroup
        className="col-span-2 sm:col-span-1"
        data-disabled={enabled ? undefined : ""}
      >
        <InputGroupAddon className="max-w-1/2 min-w-0">
          <InputGroupText className="min-w-0">
            <span className="truncate">{hostFromOrigin(site.liveUrl)}</span>
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label={tSections("pathLabel", { section: title })}
          autoComplete="off"
          disabled={!enabled}
          onChange={(event) => onPathChange(event.target.value)}
          placeholder="/"
          spellCheck={false}
          value={path}
        />
      </InputGroup>
    </div>
  );
}

function SiteSettingsToggle({
  field,
  icon,
  title,
  description,
}: SiteSettingsToggleProps) {
  const { site } = useSite().detail;
  const save = useUpdateSiteSettings();
  const pending = save.isPending ? save.variables?.[field] : undefined;
  return (
    <SiteSettingsSwitchItem
      checked={pending ?? site[field]}
      description={description}
      disabled={save.isPending}
      icon={icon}
      onCheckedChange={(checked) => save.mutate({ [field]: checked })}
      title={title}
    />
  );
}

function SiteBrandingToggle() {
  const tPage = useTranslations("sites.settingsPage");
  const tLimits = useTranslations("sites.planLimits");
  const tCommon = useTranslations("common");
  const { organizationId, organizationSlug } = useSite();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const brandingRequired =
    useSitePlanUsage(organizationId).data?.brandingRequired === true;
  if (!brandingRequired) {
    return (
      <SiteSettingsToggle
        description={tPage("brandingHint")}
        field="showBranding"
        icon={SparklesIcon}
        title={tPage("brandingLabel")}
      />
    );
  }
  return (
    <>
      <SiteSettingsSwitchItem
        action={
          <Button
            onClick={() => setUpgradeOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            {tCommon("actions.upgrade")}
          </Button>
        }
        checked
        description={tLimits("brandingRequired")}
        disabled
        icon={SparklesIcon}
        onCheckedChange={() => undefined}
        title={tPage("brandingLabel")}
      />
      <SiteUpgradeDialog
        onOpenChange={setUpgradeOpen}
        open={upgradeOpen}
        organizationSlug={organizationSlug}
      />
    </>
  );
}

function SiteAnalyticsToggle() {
  const t = useTranslations("sites.settings");
  const { organizationId, siteId, detail } = useSite();
  const invalidateSites = useInvalidateSites();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const analyticsOn = detail.site.analyticsEnabled;
  const mutation = useMutation({
    mutationFn: (analyticsEnabled: boolean) =>
      dashboardOrpc.sites.update.call({
        organizationId,
        siteId,
        analyticsEnabled,
      }),
    onSuccess: async (_result, next) => {
      toast.success(next ? t("analytics.enabled") : t("analytics.done"));
      setConfirmOpen(false);
      await invalidateSites();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("analytics.failed")));
    },
  });
  return (
    <>
      <SiteSettingsSwitchItem
        checked={analyticsOn}
        description={t("analyticsHint")}
        disabled={mutation.isPending}
        icon={Analytics01Icon}
        onCheckedChange={() => setConfirmOpen(true)}
        title={t("analyticsLabel")}
      />
      <ConfirmDialog
        confirmLabel={
          analyticsOn ? t("analytics.action") : t("analytics.enable")
        }
        description={
          analyticsOn
            ? t("analytics.confirmDescription")
            : t("analytics.enableConfirmDescription")
        }
        variant={analyticsOn ? "destructive" : "default"}
        onConfirm={() => mutation.mutate(!analyticsOn)}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        pending={mutation.isPending}
        title={
          analyticsOn
            ? t("analytics.confirmTitle")
            : t("analytics.enableConfirmTitle")
        }
      />
    </>
  );
}
