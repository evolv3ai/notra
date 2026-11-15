"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { AutomationActionIcon } from "@/components/automation/action-icon";
import { DestinationRow } from "@/components/automation/alerts/geo-alert-destinations";
import {
  EditorBox,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import Link from "@/components/framework/link";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutomationNotifySectionProps } from "@/types/automation/automations";

export function AutomationNotifySection({
  organizationId,
  value,
  onChange,
}: AutomationNotifySectionProps) {
  const t = useTranslations("automation.shared.notify");
  const tAlerts = useTranslations("automation.alerts.dialog");
  const tCommon = useTranslations("common");
  const { activeOrganization } = useOrganizationsContext();
  const { data: destinations } = useQuery(
    dashboardOrpc.automation.alerts.destinations.queryOptions({
      input: { organizationId },
    })
  );
  const slackConnected = destinations?.slackConnected === true;
  const slackMissing = destinations !== undefined && !slackConnected;

  return (
    <EditorSection hint={t("hint")} label={t("label")}>
      <EditorBox>
        <DestinationRow
          checked={value.slack}
          disabled={!(slackConnected || value.slack)}
          hint={
            slackMissing ? (
              <>
                {tAlerts("slackMissing")}{" "}
                <Link
                  className="text-foreground underline underline-offset-2"
                  href={`/${activeOrganization?.slug ?? ""}/integrations/slack`}
                >
                  {tAlerts("connectSlack")}
                </Link>
              </>
            ) : (
              tAlerts("slackHint")
            )
          }
          icon={<AutomationActionIcon kind="slack" />}
          id="notify-slack"
          label="Slack"
          onCheckedChange={(slack) => onChange({ ...value, slack })}
        />
        <DestinationRow
          checked={value.email}
          hint={tAlerts("emailHint", { count: destinations?.ownerCount ?? 1 })}
          icon={<AutomationActionIcon kind="email" />}
          id="notify-email"
          label={tCommon("labels.email")}
          onCheckedChange={(email) => onChange({ ...value, email })}
        />
      </EditorBox>
    </EditorSection>
  );
}
