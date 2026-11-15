import { PageContainer } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import type { SitesPageShellProps } from "@/types/components/sites";

export function SitesPageShell({ children, className }: SitesPageShellProps) {
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div
        className={cn(
          "w-full space-y-6 px-4 has-[[data-site-fill]]:flex has-[[data-site-fill]]:flex-1 has-[[data-site-fill]]:flex-col lg:px-6",
          className
        )}
      >
        {children}
      </div>
    </PageContainer>
  );
}
