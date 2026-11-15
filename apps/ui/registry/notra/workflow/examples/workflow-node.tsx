import { WorkflowNodeCard } from "../components/workflow-node";
import type { WorkflowNodeDemo } from "../types/workflow";

const EXAMPLES: WorkflowNodeDemo[] = [
  {
    node: {
      description: "Every Monday at 09:00",
      id: "trigger",
      kind: "trigger",
      position: { x: 0, y: 0 },
      title: "Weekly schedule",
    },
    state: { elapsedMs: 0, status: "idle" },
  },
  {
    node: {
      description: "Is this a listicle we fit in?",
      id: "classify",
      kind: "ai",
      model: "claude-sonnet-5-5",
      position: { x: 0, y: 0 },
      title: "Classify fit",
    },
    state: { elapsedMs: 1400, status: "running" },
  },
  {
    node: {
      description: "Searches 12 best-of prompts.",
      id: "search",
      kind: "integration",
      logo: "browserbase",
      position: { x: 0, y: 0 },
      title: "Search listicles",
    },
    state: { elapsedMs: 1800, status: "success" },
  },
  {
    node: {
      branch: "no",
      id: "listed",
      kind: "condition",
      outputs: [
        {
          hint: "Update the tracker",
          id: "yes",
          label: "Already listed",
          rate: 0.38,
        },
        {
          hint: "Find the site owner and pitch",
          id: "no",
          label: "Not listed",
          rate: 0.62,
        },
      ],
      position: { x: 0, y: 0 },
      rule: { operator: "mentions", subject: "Listicle", value: "Notra" },
      title: "Are we listed?",
    },
    state: { elapsedMs: 400, status: "success" },
  },
  {
    node: {
      description: "Waits for someone on the team.",
      id: "review",
      kind: "approval",
      position: { x: 0, y: 0 },
      title: "Review draft",
    },
    state: { elapsedMs: 3200, status: "waiting" },
  },
  {
    node: {
      description: "From your outreach inbox",
      id: "send",
      kind: "email",
      logo: "resend",
      position: { x: 0, y: 0 },
      title: "Send outreach",
    },
    state: { elapsedMs: 600, status: "error" },
  },
];

export default function WorkflowNodeExample() {
  return (
    <div className="flex w-full max-w-3xl flex-wrap items-start justify-center gap-6 px-3">
      {EXAMPLES.map(({ node, state }) => (
        <WorkflowNodeCard key={node.id} node={node} state={state} />
      ))}
    </div>
  );
}
