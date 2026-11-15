import { Skeleton } from "@notra/ui/components/ui/skeleton";

import { ContributorsSectionHeader } from "@/components/contributors/section-header";
import {
  CONTRIBUTORS_HEADING,
  CONTRIBUTORS_SUBCOPY,
} from "@/constants/contributors";

const CONTRIBUTORS_SKELETON_KEYS = Array.from(
  { length: 12 },
  (_, i) => `contrib-${i}`
);

function ContributorsSkeleton() {
  return (
    <div className="flex w-full max-w-320 flex-wrap justify-center gap-x-5 gap-y-6">
      {CONTRIBUTORS_SKELETON_KEYS.map((key) => (
        <div
          className="flex w-[8.875rem] flex-col items-center gap-2.5 px-1 py-4"
          key={key}
        >
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ContributorsPageSkeleton() {
  return (
    <section className="flex w-full flex-col items-center gap-13.5 px-6 pt-20 pb-20 antialiased sm:px-12 lg:px-20 lg:pt-35 lg:pb-35">
      <ContributorsSectionHeader
        description={CONTRIBUTORS_SUBCOPY}
        title={CONTRIBUTORS_HEADING}
      />
      <ContributorsSkeleton />
    </section>
  );
}
