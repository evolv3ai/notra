import { WorkflowEdge } from "../../../registry/notra/workflow/components/workflow-edge";
import { WorkflowNodeCard } from "../../../registry/notra/workflow/components/workflow-node";
import { getEdgePath } from "../../../registry/notra/workflow/lib/workflow";
import type { WorkflowNodeData } from "../../../registry/notra/workflow/types/workflow";

const SEARCH: WorkflowNodeData = {
  id: "search",
  kind: "integration",
  logo: "browserbase",
  position: { x: 0, y: 0 },
  title: "Search listicles",
};

const PITCH: WorkflowNodeData = {
  id: "pitch",
  kind: "ai",
  model: "claude-sonnet-5-5",
  position: { x: 0, y: 0 },
  title: "Draft pitch",
};

export default function WorkflowBuilderPreview() {
  return (
    <div className="relative h-40 w-[34rem] origin-top scale-[0.62]">
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        <WorkflowEdge
          path={getEdgePath({ x: 224, y: 26 }, { x: 320, y: 110 })}
          status="active"
        />
      </svg>
      <WorkflowNodeCard
        className="absolute top-0 left-0"
        node={SEARCH}
        state={{ elapsedMs: 1800, status: "success" }}
      />
      <WorkflowNodeCard
        className="absolute top-21 left-80"
        node={PITCH}
        state={{ elapsedMs: 0, status: "queued" }}
      />
    </div>
  );
}
