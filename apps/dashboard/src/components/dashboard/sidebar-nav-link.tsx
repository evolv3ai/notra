"use client";

import type { ComponentProps } from "react";

import Link from "@/components/framework/link";

export function SidebarNavLink({
  disablePrefetch = false,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch"> & {
  disablePrefetch?: boolean;
}) {
  return <Link {...props} prefetch={disablePrefetch ? false : null} />;
}
