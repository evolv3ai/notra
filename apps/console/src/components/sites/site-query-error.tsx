"use client";

import { Button } from "@/components/button";
import type { SiteQueryErrorProps } from "@/types/sites";

export function SiteQueryError({
  message,
  retrying,
  onRetry,
}: SiteQueryErrorProps) {
  return (
    <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
      <p>{message}</p>
      <Button
        className="mt-3"
        disabled={retrying}
        onClick={onRetry}
        size="sm"
        variant="outline"
      >
        Try again
      </Button>
    </div>
  );
}
