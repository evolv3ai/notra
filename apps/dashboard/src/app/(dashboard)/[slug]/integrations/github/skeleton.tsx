import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

export function GitHubIntegrationSkeleton() {
  const t = useTranslations("integrations.github.skeleton");

  return (
    <div
      aria-busy="true"
      aria-label={t("loadingAccounts")}
      role="status"
      className="divide-border divide-y"
    >
      {Array.from({ length: 2 }, (_, index) => `account-${index}`).map((id) => (
        <div className="flex items-center gap-3 px-4 py-3" key={id}>
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function GitHubRepositoriesSkeleton() {
  const t = useTranslations("integrations.github.skeleton");

  return (
    <div
      aria-busy="true"
      aria-label={t("loadingRepositories")}
      role="status"
      className="space-y-4"
    >
      {Array.from({ length: 2 }, (_, index) => `repository-${index}`).map(
        (id) => (
          <TitleCard
            action={<Skeleton className="size-7 rounded-md" />}
            contentClassName="divide-border divide-y p-0"
            footer={<Skeleton className="h-3 w-48" />}
            footerClassName="py-2.5"
            heading={<Skeleton className="h-5 w-44 max-w-full" />}
            headingAs="div"
            icon={<Skeleton className="size-5 rounded-md" />}
            key={id}
          >
            {["status", "branch", "changelog", "blog"].map((row) => (
              <div
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                key={row}
              >
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-7 w-20 shrink-0 rounded-md" />
              </div>
            ))}
          </TitleCard>
        )
      )}
    </div>
  );
}
