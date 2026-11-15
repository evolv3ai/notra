import type { ContributorsContentProps } from "~types/contributors";

import { ContributorsGrid } from "@/components/contributors/contributors-grid";
import { ContributorsSectionHeader } from "@/components/contributors/section-header";
import {
  CONTRIBUTORS_HEADING,
  CONTRIBUTORS_SUBCOPY,
} from "@/constants/contributors";

export function ContributorsContent({ data }: ContributorsContentProps) {
  return (
    <div className="w-full pb-20 lg:pb-35">
      <section className="flex w-full flex-col items-center gap-13.5 px-6 pt-20 antialiased sm:px-12 lg:px-20 lg:pt-35">
        <ContributorsSectionHeader
          description={CONTRIBUTORS_SUBCOPY}
          title={CONTRIBUTORS_HEADING}
        />
        <ContributorsGrid contributors={data.contributors} />
      </section>
    </div>
  );
}
