"use client";

import { POSTHOG_GROUP_TYPES } from "@notra/posthog/constants/posthog";
import { useConsent } from "c15t/tanstack-start";
import { useEffect } from "react";

import { POSTHOG_PROJECT_TOKEN } from "@/constants/posthog";
import {
  reapplyPostHogMeasurementConsent,
  setPostHogMeasurementConsent,
  subscribeWhenPostHogReady,
} from "@/lib/analytics/posthog-lazy";
import { authClient } from "@/lib/auth/client";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { clearPostHogIdentity } from "@/utils/posthog";

export function PostHogIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const [projectQuery] = useGeoProjectQueryState();
  const userId = session?.user.id;
  const organizationId = session?.session.activeOrganizationId ?? null;
  const projectId = projectQuery ?? null;
  const hidePersonalData = session?.user.hidePersonalData ?? true;
  const email = session?.user.email;
  const name = session?.user.name;
  const measurementGranted = useConsent("measurement");

  // Runs before the identity effects below, so they re-identify after an
  // opt-in has reset PostHog's anonymous cookieless identity.
  useEffect(() => {
    setPostHogMeasurementConsent(measurementGranted);
  }, [measurementGranted]);

  useEffect(() => {
    if (!POSTHOG_PROJECT_TOKEN || isPending) {
      return;
    }

    return subscribeWhenPostHogReady((posthog) => {
      const identifiedUserId = posthog.get_property("$user_id");

      if (!(userId && measurementGranted)) {
        if (identifiedUserId) {
          clearPostHogIdentity(posthog);
          reapplyPostHogMeasurementConsent(posthog);
        }
        return;
      }

      if (identifiedUserId && identifiedUserId !== userId) {
        clearPostHogIdentity(posthog);
        reapplyPostHogMeasurementConsent(posthog);
      }

      posthog.identify(
        userId,
        hidePersonalData ? undefined : { email, name: name ?? undefined }
      );
    });
  }, [email, hidePersonalData, isPending, measurementGranted, name, userId]);

  useEffect(() => {
    if (!POSTHOG_PROJECT_TOKEN || isPending || !userId || !measurementGranted) {
      return;
    }

    return subscribeWhenPostHogReady((posthog) => {
      posthog.resetGroups();

      if (organizationId) {
        posthog.group(POSTHOG_GROUP_TYPES.ORGANIZATION, organizationId);
        posthog.register({ organization_id: organizationId });
      } else {
        posthog.unregister("organization_id");
      }

      if (projectId) {
        posthog.group(POSTHOG_GROUP_TYPES.PROJECT, projectId);
        posthog.register({ project_id: projectId });
      } else {
        posthog.unregister("project_id");
      }
    });
  }, [isPending, measurementGranted, organizationId, projectId, userId]);

  return null;
}
