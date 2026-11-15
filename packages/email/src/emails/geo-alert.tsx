import { Link, Section, Text } from "react-email";

import { EmailCtaButton } from "../components/cta-button";
import { GeoChangeList } from "../components/geo-recap";
import { EmailLayout } from "../components/layout";
import { EmailTitleCard } from "../components/title-card";
import { GEO_RECAP_NO_ITEMS } from "../constants/geo-recap";
import { EMAIL_THEME } from "../constants/theme";
import type { GeoAlertEmailProps } from "../types/geo-recap";
import { EMAIL_CONFIG } from "../utils/config";
import { engineEmailLogoSrc } from "../utils/engine-logo";

export const GeoAlertEmail = ({
  organizationName = "Acme Inc",
  organizationSlug = "acme",
  automationName = "Competitor takes my spot",
  headline = "Linear gained ground on Acme Inc",
  summary = "Competitors took your spot or got cited in 3 answers since the previous scan.",
  items = GEO_RECAP_NO_ITEMS,
  remainingCount = 0,
  dashboardLink = `${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/geo`,
}: GeoAlertEmailProps) => (
  <EmailLayout heading={headline} preview={headline} subtext={summary}>
    {items.length > 0 ? (
      <Section>
        <EmailTitleCard heading="What changed">
          <GeoChangeList items={items} remainingCount={remainingCount} />
        </EmailTitleCard>
      </Section>
    ) : null}

    <EmailCtaButton href={dashboardLink}>Open in Notra</EmailCtaButton>

    <Section className="mt-8">
      <Text
        className="m-0 text-center text-[13px] leading-[20px]"
        style={{ color: EMAIL_THEME.subtleForeground }}
      >
        You get this because the “{automationName}” automation is on for{" "}
        {organizationName}.{" "}
        <Link
          href={`${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/automation`}
          style={{
            color: EMAIL_THEME.subtleForeground,
            textDecoration: "underline",
          }}
        >
          Manage automations
        </Link>
      </Text>
    </Section>
  </EmailLayout>
);

GeoAlertEmail.PreviewProps = {
  organizationName: "Acme Inc",
  organizationSlug: "acme",
  automationName: "Competitor takes my spot",
  headline: "Linear gained ground on Acme Inc",
  summary:
    "Competitors took your spot or got cited in 3 answers since the previous scan.",
  items: [
    {
      id: "prompt-1:openai",
      title: "best issue tracker for small engineering teams",
      changes: [
        { id: "change", detail: "Linear took your spot", tone: "down" },
      ],
      engineLabel: "ChatGPT",
      engineIconSrc: engineEmailLogoSrc("openai"),
    },
  ],
  remainingCount: 2,
  dashboardLink: "https://app.usenotra.com/acme/geo/competitors",
} satisfies GeoAlertEmailProps;

export default GeoAlertEmail;
