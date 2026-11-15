import { Mail01Icon, NoteIcon, WebhookIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import type { AutomationActionKind } from "@/types/automation/automations";

const ACTION_ICONS: Record<
  Exclude<AutomationActionKind, "slack">,
  IconSvgElement
> = {
  content: NoteIcon,
  email: Mail01Icon,
  webhook: WebhookIcon,
  alert: Mail01Icon,
};

/** What an automation does, with Slack's real logo instead of a line icon. */
export function AutomationActionIcon({
  kind,
  className,
}: {
  kind: AutomationActionKind;
  className?: string;
}) {
  if (kind === "slack") {
    return <Slack aria-hidden="true" className={className} />;
  }
  return <HugeiconsIcon className={className} icon={ACTION_ICONS[kind]} />;
}
