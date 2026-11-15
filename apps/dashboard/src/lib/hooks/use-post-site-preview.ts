import { SITE_PREVIEW_PASSWORD_MIN_LENGTH } from "@notra/sites-core/constants/sites";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { POST_PREVIEW_POLL_MS } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentSitePreviewProps } from "@/types/components/content-detail-toolbar";
import type { PostPreviewLifetime } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import {
  isPostPreviewBuilding,
  postPreviewPassword,
  postPreviewState,
} from "@/utils/post-site-preview";

function postPreviewStatusOptions(scope: {
  organizationId: string;
  siteId: string;
  postId: string;
}) {
  return dashboardOrpc.sites.previews.postStatus.queryOptions({
    input: scope,
    enabled: scope.siteId.length > 0,
    refetchInterval: (query) => {
      const preview = query.state.data;
      // A build can be ready just before its serving pointer is activated.
      const activating =
        preview?.status === "ready" &&
        !preview.live &&
        Date.parse(preview.expiresAt) > Date.now();
      return isPostPreviewBuilding(preview?.status) ||
        preview?.deleting ||
        activating
        ? POST_PREVIEW_POLL_MS
        : false;
    },
  });
}

function usePostPreviewSites(organizationId: string, postId: string) {
  const query = useQuery(
    dashboardOrpc.sites.previews.sitesForPost.queryOptions({
      input: { organizationId, postId },
      staleTime: 60_000,
    })
  );
  const sites = (query.data ?? []).filter((site) => site.previewsEnabled);
  const [chosenSiteId, setChosenSiteId] = useState<string | null>(null);
  const site = sites.find((item) => item.id === chosenSiteId) ?? sites[0];
  return { sites, site, loading: query.isPending, setChosenSiteId };
}

/** Everything the post's Preview tab reads and changes. */
export function usePostSitePreview({
  contentId,
  document,
  organizationId,
}: ContentSitePreviewProps) {
  const t = useTranslations("content.sitePreview");
  const queryClient = useQueryClient();
  const { sites, site, loading, setChosenSiteId } = usePostPreviewSites(
    organizationId,
    contentId
  );
  const scope = { organizationId, siteId: site?.id ?? "", postId: contentId };

  const statusOptions = postPreviewStatusOptions(scope);
  const statusQuery = useQuery(statusOptions);
  const preview = statusQuery.data ?? null;
  const invalidatePreviewStatus = () =>
    queryClient.invalidateQueries({ queryKey: statusOptions.queryKey });

  const [chosenLifetime, setLifetime] = useState<PostPreviewLifetime | null>(
    null
  );
  const lifetime = chosenLifetime ?? preview?.lifetime ?? "7d";
  const [passwordOn, setPasswordOn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const hasPassword = passwordOn ?? preview?.hasPassword ?? false;
  const passwordValid = password.length >= SITE_PREVIEW_PASSWORD_MIN_LENGTH;
  const resetPassword = () => {
    setPassword("");
    setPasswordOn(null);
  };
  // Drafts belong to one site's preview, not the next one picked.
  const chooseSite = (siteId: string | null) => {
    setChosenSiteId(siteId);
    setLifetime(null);
    resetPassword();
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!(await document.handleSave())) {
        throw new Error(t("saveFirst"));
      }
      return await dashboardOrpc.sites.previews.createForPost.call({
        ...scope,
        lifetime,
        password: postPreviewPassword({
          enabled: hasPassword,
          entered: passwordValid ? password : null,
          stored: preview?.hasPassword === true,
        }),
      });
    },
    // The stored settings come back with the status; reset the form only
    // after that, so the switch never flips back while the build starts.
    onSuccess: async () => {
      await invalidatePreviewStatus();
      resetPassword();
    },
    onError: (error) => toast.error(toErrorMessage(error, t("createFailed"))),
  });

  const updateAccess = useMutation({
    mutationFn: (
      input: { lifetime: PostPreviewLifetime } | { password: string | null }
    ) =>
      dashboardOrpc.sites.previews.updatePostAccess.call({
        ...scope,
        ...input,
      }),
    onSuccess: async (_result, input) => {
      toast.success(t("settingsSaved"));
      await invalidatePreviewStatus();
      if ("password" in input) {
        resetPassword();
      }
    },
    onError: (error, input) => {
      toast.error(toErrorMessage(error, t("saveFailed")));
      // Removing failed, so the stored password still guards the link.
      if ("password" in input && input.password === null) {
        setPasswordOn(null);
      }
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.previews.delete.call({
        organizationId,
        siteId: scope.siteId,
        previewKey: preview?.previewKey ?? "",
      }),
    onSuccess: async () => {
      toast.success(t("deleted"));
      await invalidatePreviewStatus();
    },
    onError: (error) => toast.error(toErrorMessage(error, t("deleteFailed"))),
  });

  const building = isPostPreviewBuilding(preview?.status) || create.isPending;
  const live = preview?.live === true && !building;
  return {
    sites,
    site,
    loading,
    setChosenSiteId: chooseSite,
    scope,
    preview,
    statusLoading: Boolean(site) && statusQuery.isPending,
    // Unknown is not "no preview": building now would drop its password.
    statusFailed: Boolean(site) && statusQuery.isError,
    deleting: preview?.deleting === true || remove.isPending,
    building,
    live,
    state: postPreviewState({ building, live, status: preview?.status }),
    lifetime,
    setLifetime,
    hasPassword,
    setPasswordOn,
    password,
    setPassword,
    passwordValid,
    create,
    updateAccess,
    remove,
  };
}

/** Loads the Preview tab's data with the post, so the tab opens complete. */
export function usePrefetchPostSitePreview(
  organizationId: string,
  postId: string
) {
  const { site } = usePostPreviewSites(organizationId, postId);
  useQuery(
    postPreviewStatusOptions({
      organizationId,
      siteId: site?.id ?? "",
      postId,
    })
  );
}
