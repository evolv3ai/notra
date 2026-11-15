"use client";

import { StopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/button";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import type { AutopilotStopButtonProps } from "@/types/autopilot";

export function AutopilotStopButton({
  organizationId,
  runId,
}: AutopilotStopButtonProps) {
  const { stop } = useAutopilotActions(organizationId);
  return (
    <Button
      disabled={stop.isPending}
      onClick={() => stop.mutate(runId)}
      size="sm"
      variant="outline"
    >
      <HugeiconsIcon icon={StopIcon} size={16} />
      Stop
    </Button>
  );
}
