import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { githubRepositoriesQueryKey } from "@/lib/db/github-collections";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  GitHubWebhookAction,
  UseGitHubWebhookActionsOptions,
} from "@/types/integrations/github";

export function useGitHubWebhookActions({
  organizationId,
  repository,
}: UseGitHubWebhookActionsOptions) {
  const t = useTranslations("integrations.github.webhookSettings");
  const queryClient = useQueryClient();
  const [action, setAction] = useState<GitHubWebhookAction | null>(null);
  const repositoryId = repository?.id ?? "";
  const input = { organizationId, repositoryId };
  const webhookQueryKey =
    dashboardOrpc.integrations.repositories.webhook.get.queryKey({ input });
  const config = useQuery({
    ...dashboardOrpc.integrations.repositories.webhook.get.queryOptions({
      input,
      enabled: action === "setup" && Boolean(repositoryId),
    }),
    retry: false,
  });
  const generate = useMutation({
    mutationFn: () =>
      dashboardOrpc.integrations.repositories.webhook.generateSecret.call(
        input
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: webhookQueryKey }),
        queryClient.invalidateQueries({
          queryKey: githubRepositoriesQueryKey(organizationId),
        }),
      ]);
      toast.success(t("secretGenerated"));
    },
    onError: (error) => toast.error(error.message),
  });
  const repair = useMutation({
    mutationFn: () =>
      dashboardOrpc.integrations.repositories.webhook.repair.call(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: webhookQueryKey });
      setAction(null);
      toast.success(t("repaired"));
    },
  });
  const busy = generate.isPending || repair.isPending;

  const open = (next: GitHubWebhookAction) => {
    if (busy || !repositoryId) {
      return;
    }
    if (next === "repair") {
      repair.reset();
    }
    setAction(next);
  };

  const close = () => {
    if (!busy) {
      setAction(null);
    }
  };

  const rotate = () => {
    generate.mutate(undefined, { onSuccess: () => setAction(null) });
  };

  return {
    action,
    busy,
    close,
    config,
    generate,
    hasWebhook: repository?.hasWebhook,
    open,
    repair,
    rotate,
  };
}
