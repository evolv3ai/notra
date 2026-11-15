"use client";

import {
  Alert02Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteConfigExample } from "@/components/sites/site-config-example";
import type { SiteInthProjectSettingsProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import { c15tConfigExample } from "@/utils/site-consent";

export function SiteInthProjectSettings({
  inth,
  status,
}: SiteInthProjectSettingsProps) {
  const t = useTranslations("sites.integrationsPage.consent");
  const fieldId = useId();
  const { projects, selected, selectedId, setPicked, connect, applyProject } =
    inth;
  const current = status.project;
  const missingOrigins = status.missingOrigins;
  const hasProjects = Boolean(projects.data && projects.data.length > 0);

  return (
    <div className="space-y-5">
      <Field>
        <FieldLabel htmlFor={fieldId}>{t("project")}</FieldLabel>
        {projects.isPending ? <Skeleton className="h-9 w-full" /> : null}
        {hasProjects ? (
          <Select
            onValueChange={(value: string | null) => setPicked(value)}
            value={selectedId}
          >
            <SelectTrigger className="w-full" id={fieldId}>
              <SelectValue>
                {(value: string) =>
                  projects.data?.find((project) => project.id === value)
                    ?.name ?? t("project")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects.data?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {projects.isError ? (
          <FieldError>
            {toErrorMessage(projects.error, t("projectsFailed"))}
          </FieldError>
        ) : null}
        <FieldDescription>
          {projects.data?.length === 0
            ? t("noProjects")
            : t("projectDescription")}
        </FieldDescription>
        {selected && !selected.backendUrl ? (
          <FieldError>{t("noBackend")}</FieldError>
        ) : null}
      </Field>
      {current ? (
        <dl className="divide-y rounded-lg border text-sm">
          <div className="flex items-center justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">{t("activeProject")}</dt>
            <dd className="min-w-0">
              <a
                className="inline-flex items-center gap-1 font-medium hover:underline"
                href={current.dashboardUrl}
                rel="noopener"
                target="_blank"
              >
                {current.name}
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={ArrowUpRight01Icon}
                  size={12}
                />
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">{t("domains")}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              {missingOrigins.length > 0 ? (
                <Button
                  disabled={connect.isPending}
                  loading={connect.isPending}
                  onClick={() => applyProject(current.id)}
                  size="sm"
                  variant="outline"
                >
                  {t("addOrigins")}
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="text-success size-4"
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={1.5}
                  />
                  {t("domainsTrusted")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      ) : null}
      {current?.backendUrl ? (
        <SiteConfigExample value={c15tConfigExample(current.backendUrl)} />
      ) : null}
      {current && missingOrigins.length > 0 ? (
        <Alert variant="warning">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={1.5}
          />
          <AlertTitle>{t("missingOriginsTitle")}</AlertTitle>
          <AlertDescription>
            <p>
              {t("missingOriginsDescription", {
                origins: missingOrigins.join(", "),
              })}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
