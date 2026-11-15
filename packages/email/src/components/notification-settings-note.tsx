import { Link, Section, Text } from "react-email";

import { EMAIL_THEME } from "../constants/theme";
import { EMAIL_CONFIG } from "../utils/config";

export const EmailNotificationSettingsNote = ({
  organizationName,
  organizationSlug,
  automationNames,
}: {
  organizationName: string;
  organizationSlug: string;
  /** Set when the automations themselves asked for the email, not the settings. */
  automationNames?: string;
}) => (
  <Section className="mt-8">
    <Text
      className="m-0 text-center text-[13px] leading-[20px]"
      style={{ color: EMAIL_THEME.subtleForeground }}
    >
      {automationNames
        ? `You get this because email is on in the Then notify step of ${automationNames}.`
        : `You get this because email notifications are on for ${organizationName}.`}{" "}
      <Link
        href={`${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/${automationNames ? "automation" : "settings/notifications"}`}
        style={{
          color: EMAIL_THEME.subtleForeground,
          textDecoration: "underline",
        }}
      >
        {automationNames ? "Manage automations" : "Manage email notifications"}
      </Link>
    </Text>
  </Section>
);
