import { createFileRoute } from "@tanstack/react-router";

import { FeatureDetailPage } from "@/components/feature-pages/feature-detail-page";
import { SitesFeatures } from "@/components/feature-pages/sites-features";
import { SitesHeadline } from "@/components/feature-pages/sites-headline";
import { SitesStage } from "@/components/feature-pages/sites-stage";
import { FaqSection } from "@/components/landing/faq-section";
import { SITES_FAQ, SITES_PAGE } from "@/constants/feature-pages/sites";
import { buildFeatureDetailHead } from "@/utils/feature-detail-page";

export const Route = createFileRoute("/_site/features/sites")({
  head: () => buildFeatureDetailHead(SITES_PAGE),
  component: SitesPage,
});

function SitesPage() {
  return (
    <FeatureDetailPage
      copy={SITES_PAGE}
      footer={<FaqSection className="py-0 lg:py-0" content={SITES_FAQ} />}
      stage={<SitesStage />}
      title={<SitesHeadline />}
    >
      <SitesFeatures />
    </FeatureDetailPage>
  );
}
