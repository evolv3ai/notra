import type { AuthenticationResponse } from "@workos-inc/node";
import { getWorkOS } from "@workos/authkit-session";
import { Effect } from "effect";

import { tryWorkOSAuth, type WorkOSAuthError } from "@/lib/auth/errors";
import { readWorkOSError } from "@/lib/auth/workos-error";

const ORG_SELECTION_REQUIRED_CODE = "organization_selection_required";

export const authenticateResolvingOrgSelection = (
  run: () => Promise<AuthenticationResponse>
): Effect.Effect<AuthenticationResponse, WorkOSAuthError> =>
  tryWorkOSAuth(run).pipe(
    Effect.catch((error) => {
      const info = readWorkOSError(error.error);
      const organizationId = info.organizationIds[0];

      if (
        info.code !== ORG_SELECTION_REQUIRED_CODE ||
        !info.pendingAuthenticationToken ||
        !organizationId
      ) {
        return Effect.fail(error);
      }

      return tryWorkOSAuth(() =>
        getWorkOS().userManagement.authenticateWithOrganizationSelection({
          clientId: process.env.WORKOS_CLIENT_ID ?? "",
          pendingAuthenticationToken: info.pendingAuthenticationToken ?? "",
          organizationId,
        })
      );
    })
  );
