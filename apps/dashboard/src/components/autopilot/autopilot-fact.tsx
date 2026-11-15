import type { AutopilotFactProps } from "@/types/autopilot";

/** One label and value in a run's or a pull request's facts row. */
export function AutopilotFact({ label, children }: AutopilotFactProps) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 text-sm tabular-nums">{children}</dd>
    </div>
  );
}
