"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  type Organization,
  useOrganizationsContext,
} from "@/components/providers/organization-provider";
import { ORG_SWITCH_STATIC_PAGE_SECTIONS } from "@/constants/nav";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { authClient } from "@/lib/auth/client";
import { usePathname, useRouter } from "@/lib/navigation";
import { errorMessageOr } from "@/lib/utils";
import { setLastVisitedOrganization } from "@/utils/cookies";
import { QUERY_KEYS } from "@/utils/query-keys";

function sectionPath(segments: string[]): string {
  const [section, page] = segments;
  return section && page && ORG_SWITCH_STATIC_PAGE_SECTIONS.has(section)
    ? `${section}/${page}`
    : (section ?? "");
}

/** Makes `org` active and keeps the current section when switching. */
export function useSwitchOrganization() {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { activeOrganization, organizations } = useOrganizationsContext();
  const [isPending, startTransition] = useTransition();
  const [isSwitching, setIsSwitching] = useState(false);

  async function switchOrganization(org: Organization) {
    if (org.slug === activeOrganization?.slug) {
      return;
    }

    const currentSlug = activeOrganization?.slug;
    let targetPath = `/${org.slug}`;

    if (currentSlug && pathname) {
      const segments = pathname.split("/").filter(Boolean);
      if (segments[0] === currentSlug && segments.length > 1) {
        targetPath = `/${org.slug}/${sectionPath(segments.slice(1))}`;
      }
    }

    router.prefetch(targetPath);
    setIsSwitching(true);

    try {
      const { error } = await authClient.organization.setActive({
        organizationId: org.id,
      });

      if (error) {
        const message = errorMessageOr(
          error.message,
          tCommon("labels.failedToSwitchOrganization")
        );
        toast.error(message);
        setIsSwitching(false);
        return;
      }

      await setLastVisitedOrganization(org.slug);
      trackEvent(POSTHOG_EVENTS.ORG_SWITCHED, {
        from_organization_id: activeOrganization?.id ?? null,
        to_organization_id: org.id,
        organization_count: organizations.length,
      });
      queryClient.invalidateQueries({ refetchType: "none" });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.AUTH.activeOrganization,
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.AUTH.session,
        }),
      ]);

      setIsSwitching(false);
      startTransition(() => {
        router.replace(targetPath);
      });
    } catch (error) {
      toast.error(tCommon("labels.failedToSwitchOrganization"));
      console.error(error);
      setIsSwitching(false);
    }
  }

  return { switchOrganization, isSwitching: isSwitching || isPending };
}
