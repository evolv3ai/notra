"use client";

import { useDeferredMount } from "@/lib/hooks/use-deferred-mount";
import dynamic from "@/utils/lazy-component";

const SidebarOnboarding = dynamic(
  () =>
    import("@/components/dashboard/sidebar-onboarding").then(
      (module) => module.SidebarOnboarding
    ),
  { ssr: false }
);

export function DeferredSidebarStatus() {
  const ready = useDeferredMount();

  if (!ready) {
    return null;
  }

  return <SidebarOnboarding />;
}
