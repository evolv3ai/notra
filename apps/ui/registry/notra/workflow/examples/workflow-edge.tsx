import { WorkflowEdge } from "../components/workflow-edge";
import { getEdgePath } from "../lib/workflow";
import type { WorkflowEdgeDemo } from "../types/workflow";

const PATH = getEdgePath({ x: 6, y: 40 }, { x: 314, y: 8 });

const STATUSES: WorkflowEdgeDemo[] = [
  { label: "idle", status: "idle" },
  { animated: true, label: "animated", status: "idle" },
  { label: "active", status: "active" },
  { label: "done", status: "done" },
  { label: "skipped", status: "skipped" },
];

export default function WorkflowEdgeExample() {
  return (
    <div className="grid w-full max-w-md gap-1">
      {STATUSES.map(({ animated, label, status }) => (
        <div
          className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3"
          key={label}
        >
          <span className="text-muted-foreground font-mono text-xs">
            {label}
          </span>
          <svg
            aria-hidden="true"
            className="h-12 w-full overflow-visible"
            viewBox="0 0 320 48"
          >
            <WorkflowEdge animated={animated} path={PATH} status={status} />
          </svg>
        </div>
      ))}
    </div>
  );
}
