import { Text } from "react-email";

import { EmailButtonFallbackLink } from "../components/button-fallback-link";
import { EmailCtaButton } from "../components/cta-button";
import { EmailDetailRow } from "../components/detail-row";
import { EmailLayout } from "../components/layout";
import { EmailTitleCard } from "../components/title-card";
import { EMAIL_THEME } from "../constants/theme";
import type { SiteSuspendedEmailProps } from "../types/site-suspended";
import { toPreviewText } from "../utils/preview";

export const SiteSuspendedEmail = ({
  organizationName = "Acme Inc",
  scope = "site",
  siteNames = ["Acme Blog"],
  categoryLabel = "Phishing or credential harvesting",
  reason = "The home page asks visitors for their Microsoft 365 password.",
  appealEmail = "abuse@usenotra.com",
}: SiteSuspendedEmailProps) => {
  const appealLink = `mailto:${appealEmail}?subject=${encodeURIComponent(`Appeal: ${organizationName}`)}`;
  const summary =
    scope === "workspace" ? (
      <>
        Notra suspended the <strong>{organizationName}</strong> workspace. Its
        sites are offline, and new sites, builds and API requests are blocked.
      </>
    ) : (
      <>
        Notra suspended a site in <strong>{organizationName}</strong>. Every
        domain of the site is offline and its builds are paused.
      </>
    );
  return (
    <EmailLayout
      heading={scope === "workspace" ? "Workspace suspended" : "Site suspended"}
      preview={toPreviewText(`${categoryLabel}: ${reason}`)}
      subtext={summary}
    >
      <EmailTitleCard heading="Details">
        {siteNames.length > 0 ? (
          <EmailDetailRow
            first
            label={siteNames.length === 1 ? "Site" : "Sites"}
          >
            {siteNames.join(", ")}
          </EmailDetailRow>
        ) : null}
        <EmailDetailRow first={siteNames.length === 0} label="Category">
          {categoryLabel}
        </EmailDetailRow>
        <EmailDetailRow label="Reason">{reason}</EmailDetailRow>
      </EmailTitleCard>

      <Text
        style={{
          color: EMAIL_THEME.foreground,
          fontSize: "14px",
          lineHeight: "22px",
        }}
      >
        If you think this is a mistake, ask for a review at {appealEmail}. Tell
        us what the {scope === "workspace" ? "workspace" : "site"} is for and
        what you changed, and we will get back to you.
      </Text>

      <EmailCtaButton href={appealLink}>Request a review</EmailCtaButton>
      <EmailButtonFallbackLink href={appealLink} />
    </EmailLayout>
  );
};
