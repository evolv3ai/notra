import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@notra/ui/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  GitHubReviewProcessProps,
  GitHubReviewProcessUpdate,
} from "@/types/integrations/github";

export function GitHubReviewProcess({
  organizationId,
  repository,
  contentType,
  disabled,
  config,
}: GitHubReviewProcessProps) {
  const t = useTranslations("content.gitPublishing");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: GitHubReviewProcessUpdate) =>
      dashboardOrpc.integrations.repositories.contentDirectory.update.call({
        organizationId,
        repositoryId: repository.id,
        contentType,
        ...value,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey:
          dashboardOrpc.integrations.repositories.contentDirectory.get.key(),
      }),
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel>{t("reviewProcess")}</FieldLabel>
        <Select
          value={config.reviewProcess}
          onValueChange={(value) => {
            if (value === "direct" || value === "pull_request") {
              mutation.mutate({ reviewProcess: value });
            }
          }}
          disabled={disabled || mutation.isPending}
        >
          <SelectTrigger aria-label={t("reviewProcess")}>
            <SelectValue>
              {config.reviewProcess === "direct"
                ? t("direct")
                : t("pullRequest")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pull_request">{t("pullRequest")}</SelectItem>
            <SelectItem value="direct">{t("direct")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">
          {config.reviewProcess === "direct"
            ? t("directHint")
            : t("pullRequestHint")}
        </p>
      </Field>
      {config.sites.length > 1 ? (
        <Field>
          <FieldLabel>{t("site")}</FieldLabel>
          <Select
            value={config.siteId}
            onValueChange={(value) => {
              if (value) {
                mutation.mutate({ siteId: value });
              }
            }}
            disabled={disabled || mutation.isPending}
          >
            <SelectTrigger aria-label={t("site")}>
              <SelectValue placeholder={t("chooseSite")}>
                {config.sites.find((site) => site.id === config.siteId)?.name}
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
    </div>
  );
}
