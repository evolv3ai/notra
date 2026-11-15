"use client";

import { useEffect, useState } from "react";

import { isWorkspaceSlugAvailable } from "@/app/onboarding/workspace/actions";
import type { WorkspaceSlugCheck } from "@/types/onboarding";

export function useWorkspaceSlugStatus(
  slug: string,
  enabled: boolean
): WorkspaceSlugCheck["status"] | null {
  const [slugCheck, setSlugCheck] = useState<WorkspaceSlugCheck | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const check = async (attempt: number) => {
      try {
        const available = await isWorkspaceSlugAvailable(slug);
        if (!cancelled) {
          setSlugCheck({
            slug,
            status: available ? "available" : "unavailable",
          });
        }
      } catch {
        if (cancelled) {
          return;
        }
        if (attempt < 2) {
          timeout = setTimeout(() => check(attempt + 1), 400 * 2 ** attempt);
        } else {
          setSlugCheck({ slug, status: "error" });
        }
      }
    };

    timeout = setTimeout(() => check(0), 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [slug, enabled]);

  if (!enabled) {
    return null;
  }
  return slugCheck?.slug === slug ? slugCheck.status : "checking";
}
