import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import Link from "@/components/framework/link";
import { cn } from "@/lib/utils";
import type { BackLinkProps } from "@/types/components/back-link";

export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link
      className={cn(
        "text-muted-foreground hover:text-foreground duration-fast inline-flex w-fit items-center gap-1 text-sm transition-colors",
        className
      )}
      href={href}
    >
      <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
      {children}
    </Link>
  );
}
