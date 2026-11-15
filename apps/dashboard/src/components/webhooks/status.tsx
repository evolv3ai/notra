import { StatusBadge } from "@notra/ui/components/status-badge";
import { useTranslations } from "use-intl";

import { WEBHOOK_STATUS_VARIANTS } from "@/constants/outbound-webhooks";
import type { OutboundDelivery } from "@/types/webhooks/outbound";

export function WebhookStatus({ status }: Pick<OutboundDelivery, "status">) {
  const t = useTranslations("settings.panes.webhooks.statuses");
  return (
    <StatusBadge
      appearance={{ variant: WEBHOOK_STATUS_VARIANTS[status] }}
      label={t(status)}
    />
  );
}
