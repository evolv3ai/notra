import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { updateUsageAlertsInputSchema } from "@notra/schemas/dashboard/usage-alerts";

import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { forbidden, serviceUnavailable } from "@/lib/orpc/utils/errors";
import { setDevelopmentUsageAlerts } from "@/utils/development-usage-alerts";

export const usageAlertsRouter = {
  update: authorizedProcedure
    .input(updateUsageAlertsInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      if (context.auth.membership.role !== "owner") {
        const tErrors = await getTranslations("errors.usageAlerts");
        throw forbidden(tErrors("ownerOnly"));
      }

      if (!autumn) {
        if (allowUnmeteredAiInDevelopment) {
          return {
            alerts: setDevelopmentUsageAlerts(
              input.organizationId,
              input.alerts
            ),
          };
        }
        throw serviceUnavailable(
          (await getTranslations("common.errors"))("generic")
        );
      }

      await autumn.customers.update({
        customerId: input.organizationId,
        billingControls: {
          usageAlerts: input.alerts,
        },
      });

      return {
        alerts: input.alerts,
      };
    }),
};
