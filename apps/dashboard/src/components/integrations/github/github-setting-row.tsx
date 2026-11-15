import { Label } from "@notra/ui/components/ui/label";

import type { GitHubSettingRowProps } from "@/types/integrations/github";

export function GitHubSettingRow({
  title,
  description,
  htmlFor,
  children,
}: GitHubSettingRowProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        {htmlFor ? (
          <Label className="cursor-pointer" htmlFor={htmlFor}>
            {title}
          </Label>
        ) : (
          <p className="text-sm font-medium">{title}</p>
        )}
        {description ? (
          <div className="text-muted-foreground text-xs">{description}</div>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
