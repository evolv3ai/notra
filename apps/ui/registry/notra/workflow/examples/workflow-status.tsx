import {
  WorkflowDeterminismBadge,
  WorkflowStatusBadge,
} from "../components/workflow-status";
import type { WorkflowNodeStatus } from "../types/workflow";

const STATUSES: WorkflowNodeStatus[] = [
  "idle",
  "queued",
  "running",
  "waiting",
  "success",
  "error",
  "skipped",
];

export default function WorkflowStatusExample() {
  return (
    <div className="flex max-w-lg flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        {STATUSES.map((status) => (
          <WorkflowStatusBadge key={status} status={status} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <WorkflowDeterminismBadge deterministic />
        <WorkflowDeterminismBadge deterministic={false} />
      </div>
    </div>
  );
}
