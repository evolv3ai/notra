"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, buttonVariants } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SharedChatContinueProps } from "@/types/chat-share";
import type { OrganizationRow } from "@/types/organizations/actions";
import { QUERY_KEYS } from "@/utils/query-keys";

/**
 * Copies the shared chat into one of the reader's workspaces and opens it, so
 * a signed-in reader can pick the conversation up where it ended.
 */
export function SharedChatContinue({ shareId }: SharedChatContinueProps) {
  const t = useTranslations("chat.sharedPage");
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { data: organizations = [] } = useQuery({
    queryKey: QUERY_KEYS.AUTH.organizations,
    queryFn: async () =>
      (await dashboardOrpcClient.organization.list()).data ?? [],
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  const fork = useMutation({
    mutationFn: async (organization: OrganizationRow) => {
      const { chatId } = await dashboardOrpc.chat.shares.fork.call({
        organizationId: organization.id,
        shareId,
      });
      return `/${organization.slug}/chat/${chatId}`;
    },
    onSuccess: (href) => router.push(href),
    onError: () => toast.error(t("forkFailed")),
  });

  if (isSessionPending) {
    return null;
  }

  if (!session) {
    return (
      <Link
        className={buttonVariants({ size: "sm" })}
        href={`/login?returnTo=${encodeURIComponent(`/share/${shareId}`)}`}
      >
        {t("signInToContinue")}
      </Link>
    );
  }

  const activeOrganization =
    organizations.find(
      (organization) => organization.id === session.session.activeOrganizationId
    ) ?? organizations[0];
  if (!activeOrganization) {
    return null;
  }

  const busy = fork.isPending || fork.isSuccess;
  if (organizations.length === 1) {
    return (
      <Button
        loading={busy}
        onClick={() => fork.mutate(activeOrganization)}
        size="sm"
      >
        {t("continue")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button loading={busy} size="sm" />}>
        {t("continue")}
        <HugeiconsIcon className="size-3.5" icon={ArrowDown01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("chooseWorkspace")}</DropdownMenuLabel>
          {[
            activeOrganization,
            ...organizations.filter(
              (organization) => organization.id !== activeOrganization.id
            ),
          ].map((organization) => (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => fork.mutate(organization)}
            >
              <span className="truncate">{organization.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
