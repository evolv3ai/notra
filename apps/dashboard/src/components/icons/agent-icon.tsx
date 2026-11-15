import { cn } from "@notra/ui/lib/utils";

import { AGENT_ICON_DOTS } from "@/constants/agent-icon";

export function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {AGENT_ICON_DOTS.map(({ cx, cy, r }) => (
        <circle cx={cx} cy={cy} key={`${cx}-${cy}`} r={r} />
      ))}
    </svg>
  );
}
