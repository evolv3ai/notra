import { WorkflowNodeCard } from "../../../registry/notra/workflow/components/workflow-node";
import { LISTICLE_OUTREACH_WORKFLOW } from "../../../registry/notra/workflow/constants/workflow-templates";

const CLASSIFY = LISTICLE_OUTREACH_WORKFLOW.nodes.find(
  (node) => node.id === "classify"
);

export default function WorkflowNodePreview() {
  return CLASSIFY ? (
    <div className="origin-top scale-90 pt-4">
      <WorkflowNodeCard
        node={CLASSIFY}
        state={{ elapsedMs: 1400, status: "running" }}
      />
    </div>
  ) : null;
}
