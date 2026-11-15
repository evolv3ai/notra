import { cn } from "@notra/ui/lib/utils";

import { SitesCardConfig } from "@/components/feature-pages/sites-card-config";
import { SitesCardDeployments } from "@/components/feature-pages/sites-card-deployments";
import { SitesCardDomains } from "@/components/feature-pages/sites-card-domains";
import { SitesCardFiles } from "@/components/feature-pages/sites-card-files";
import { FeaturesCard } from "@/components/landing/features-card";
import {
  FEATURE_SECTION_CLASS,
  FEATURE_SECTION_HEADING_CLASS,
} from "@/constants/feature-pages/layout";
import {
  SITES_CONFIG_CARD,
  SITES_DEPLOYMENTS_CARD,
  SITES_DOMAINS_CARD,
  SITES_FILES_CARD,
  SITES_PAGE,
} from "@/constants/feature-pages/sites";

export function SitesFeatures() {
  return (
    <section className={cn(FEATURE_SECTION_CLASS, "flex flex-col gap-12")}>
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 className={FEATURE_SECTION_HEADING_CLASS}>
          {SITES_PAGE.overview.heading}
        </h2>
        <p className="font-sans text-[1.0625rem]/6.75 text-[#6B6B6B] dark:text-white/60">
          {SITES_PAGE.overview.description}
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
        <FeaturesCard copy={SITES_DEPLOYMENTS_CARD.copy}>
          <SitesCardDeployments />
        </FeaturesCard>
        <FeaturesCard copy={SITES_DOMAINS_CARD.copy}>
          <SitesCardDomains />
        </FeaturesCard>
        <FeaturesCard copy={SITES_FILES_CARD.copy}>
          <SitesCardFiles />
        </FeaturesCard>
        <FeaturesCard copy={SITES_CONFIG_CARD.copy}>
          <SitesCardConfig />
        </FeaturesCard>
      </div>
    </section>
  );
}
