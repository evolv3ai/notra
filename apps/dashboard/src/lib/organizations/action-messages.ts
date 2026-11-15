import { Effect } from "effect";

import { ActionFailure } from "@/lib/actions/errors";
import { getTranslations } from "@/lib/i18n/server";
import type { OrganizationActionMessageKey } from "@/types/organizations/action-messages";

export const organizationActionMessage = (key: OrganizationActionMessageKey) =>
  Effect.promise(() => getTranslations("errors")).pipe(
    Effect.map((t) => t(key))
  );

export const failWithOrganizationMessage = (
  key: OrganizationActionMessageKey
) =>
  organizationActionMessage(key).pipe(
    Effect.flatMap((message) => Effect.fail(new ActionFailure({ message })))
  );

export const noActiveOrganizationMessage = Effect.promise(() =>
  getTranslations("common.labels")
).pipe(Effect.map((t) => t("noActiveOrganization")));
