"use client";

import { SourceCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";

import { Button } from "@/components/button";
import type { SystemSkillCodeAlertProps } from "@/types/skills";

export function SystemSkillCodeAlert({
  version,
  onLoad,
}: SystemSkillCodeAlertProps) {
  return (
    <Alert role="status" variant="info">
      <HugeiconsIcon icon={SourceCodeIcon} />
      <AlertTitle className="text-foreground">
        Code has a newer copy of this skill
      </AlertTitle>
      <AlertDescription>
        It differs from v{version}. Load it to review the changes and publish
        them.
      </AlertDescription>
      <AlertAction>
        <Button onClick={onLoad} size="sm" variant="outline">
          Load code version
        </Button>
      </AlertAction>
    </Alert>
  );
}
