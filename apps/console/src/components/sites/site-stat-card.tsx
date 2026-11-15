import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";

import type {
  SiteStatCardProps,
  SiteStatCardSkeletonProps,
} from "@/types/sites";

/** Same box as a loaded card, so values arriving don't shift the layout. */
export function SiteStatCardSkeleton({ label }: SiteStatCardSkeletonProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex h-8 items-center">
        <Skeleton className="h-6 w-14" />
      </div>
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SiteStatCard({
  label,
  value,
  hint,
  tone = "default",
}: SiteStatCardProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground truncate text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
