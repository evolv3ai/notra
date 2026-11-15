"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Label } from "@notra/ui/components/ui/label";
import { cn } from "@notra/ui/lib/utils";

export function Field({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ListRow({
  onRemove,
  removeLabel,
  children,
}: {
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid gap-2 rounded-xl border p-3 pr-10">
      {children}
      <Button
        className="absolute top-2 right-2"
        onClick={onRemove}
        size="icon-xs"
        variant="ghost"
      >
        <HugeiconsIcon icon={Cancel01Icon} />
        <span className="sr-only">{removeLabel}</span>
      </Button>
    </div>
  );
}

export function EditorSection({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-dashed" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 py-4">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          {description ? (
            <span className="text-muted-foreground block text-xs">
              {description}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground text-xs group-open:hidden">
          Show
        </span>
        <span className="text-muted-foreground hidden text-xs group-open:inline">
          Hide
        </span>
      </summary>
      <div className="grid gap-4 pb-6">{children}</div>
    </details>
  );
}
