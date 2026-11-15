"use client";

import { clear } from "@databuddy/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { resetPostHogIdentity } from "@/lib/analytics/posthog-client";
import { signOutAction } from "@/lib/auth/sign-out-action";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import type { ClientSessionData } from "@/types/auth/session";
import type { SignOutActionOptions } from "@/types/auth/user-actions";
import { allowUnloadAfterSignOut, confirmSignOut } from "@/utils/before-unload";
import { QUERY_KEYS } from "@/utils/query-keys";

async function fetchSession(
  signal: AbortSignal
): Promise<ClientSessionData | null> {
  const response = await fetch("/api/session", { cache: "no-store", signal });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function useSession() {
  const query = useQuery({
    queryKey: QUERY_KEYS.AUTH.session,
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

function useListOrganizations() {
  const query = useQuery({
    queryKey: QUERY_KEYS.AUTH.organizations,
    queryFn: async () => {
      const result = await dashboardOrpcClient.organization.list();
      return result.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

function useSessionInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.setQueryData(QUERY_KEYS.AUTH.session, null);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.session });
  };
}

function useSignOut() {
  const queryClient = useQueryClient();
  const t = useTranslations();

  return async (options?: SignOutActionOptions) => {
    if (
      !(await confirmSignOut(
        t("nav.user.confirmSignOutUnsaved"),
        t("common.labels.logOut"),
        t("common.actions.cancel")
      ))
    ) {
      return;
    }
    const toastId = toast.loading(t("nav.user.signingOut"));
    try {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.AUTH.session });
      const destination = await signOutAction({ returnTo: options?.returnTo });
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.AUTH.session });
      queryClient.setQueryData(QUERY_KEYS.AUTH.session, null);
      resetPostHogIdentity();
      clear();
      toast.success(t("common.labels.signedOutSuccessfully"), { id: toastId });
      allowUnloadAfterSignOut();
      window.location.replace(destination);
    } catch (error) {
      toast.dismiss(toastId);
      throw error;
    }
  };
}

export const authClient = {
  useSession,
  useListOrganizations,
  useSessionInvalidation,
  useSignOut,
  updateUser: dashboardOrpcClient.user.account.update,
  deleteUser: () => dashboardOrpcClient.user.account.delete(),
  requestPasswordReset: () =>
    dashboardOrpcClient.user.account.requestPasswordReset(),
  listAccounts: () => dashboardOrpcClient.user.account.listConnections(),
  unlinkAccount: dashboardOrpcClient.user.account.unlinkConnection,
  security: {
    getOverview: () => dashboardOrpcClient.user.security.overview(),
    startTotpEnrollment: () =>
      dashboardOrpcClient.user.security.startTotpEnrollment(),
    verifyTotpEnrollment:
      dashboardOrpcClient.user.security.verifyTotpEnrollment,
    discardTotpEnrollment:
      dashboardOrpcClient.user.security.discardTotpEnrollment,
    removeAuthFactor: dashboardOrpcClient.user.security.removeAuthFactor,
    regenerateBackupCodes:
      dashboardOrpcClient.user.security.regenerateBackupCodes,
  },
  organization: {
    create: dashboardOrpcClient.organization.create,
    update: dashboardOrpcClient.organization.update,
    list: () => dashboardOrpcClient.organization.list(),
    setActive: dashboardOrpcClient.organization.setActive,
    getFullOrganization: dashboardOrpcClient.organization.getFull,
    getSummary: dashboardOrpcClient.organization.getSummary,
    listMembers: dashboardOrpcClient.organization.listMembers,
    listInvitations: dashboardOrpcClient.organization.listInvitations,
    inviteMember: dashboardOrpcClient.organization.inviteMember,
    cancelInvitation: dashboardOrpcClient.organization.cancelInvitation,
    resendInvitation: dashboardOrpcClient.organization.resendInvitation,
    updateMemberRole: dashboardOrpcClient.organization.updateMemberRole,
    removeMember: dashboardOrpcClient.organization.removeMember,
  },
};
