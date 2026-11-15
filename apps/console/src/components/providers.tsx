"use client";

import { FrameworkProvider } from "@notra/ui/components/framework-provider";
import { Toaster } from "@notra/ui/components/ui/sonner";
import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SHARE_ROUTE_PREFIX } from "@/constants/geo-report";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = pathname.startsWith(SHARE_ROUTE_PREFIX)
    ? "light"
    : undefined;
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        disableTransitionOnChange
        enableSystem
        forcedTheme={forcedTheme}
      >
        <FrameworkProvider Link={Link}>
          <MotionConfig reducedMotion="user">
            <TooltipProvider>
              {children}
              <Toaster position="top-center" />
            </TooltipProvider>
          </MotionConfig>
        </FrameworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
