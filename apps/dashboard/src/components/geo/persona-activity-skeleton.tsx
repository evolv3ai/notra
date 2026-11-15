"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { InstrumentModule } from "ui/card";
import { useTranslations } from "use-intl";

export function PersonaActivityBodySkeleton({ count }: { count: number }) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 pt-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: count }, (_, index) => (
          <div className="min-w-0 space-y-1" key={index}>
            <div className="flex min-h-6 items-center">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex h-7 items-center">
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="mt-2 flex h-4 justify-end">
        <Skeleton className="h-3 w-40" />
      </div>
    </>
  );
}

export function PersonaActivityCardSkeleton({ count }: { count: number }) {
  const t = useTranslations("geo.personaActivityCard");
  return (
    <InstrumentModule
      eyebrow={t("eyebrow")}
      action={<Skeleton className="h-7 w-[8.625rem] rounded-md" />}
      variant="table"
      bodyClassName="px-4 pb-4 pt-2"
    >
      <PersonaActivityBodySkeleton count={count} />
    </InstrumentModule>
  );
}
