"use client";

import { useEffect } from "react";

import {
  useDemoSandbox,
  useSyncDemoTimeZone,
} from "@/lib/hooks/use-demo-sandbox";

export function DemoTimeZoneSync() {
  const { data: sandbox } = useDemoSandbox(true);
  const { mutate: syncTimeZone } = useSyncDemoTimeZone();
  const sandboxTimeZone = sandbox?.timeZone;

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!sandboxTimeZone || sandboxTimeZone === browserTimeZone) {
      return;
    }
    syncTimeZone(browserTimeZone);
  }, [sandboxTimeZone, syncTimeZone]);

  return null;
}
