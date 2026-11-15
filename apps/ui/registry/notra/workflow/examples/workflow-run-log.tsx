import { WorkflowRunLog } from "../components/workflow-run-log";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { CONTENT_REFRESH_WORKFLOW } from "../constants/workflow-templates";
import { getRunLog, scheduleRun } from "../lib/workflow";

const { edges, nodes } = CONTENT_REFRESH_WORKFLOW;
const SCHEDULE = scheduleRun(nodes, edges);
const LOG = getRunLog(nodes, SCHEDULE, "done", SCHEDULE.totalMs);

export default function WorkflowRunLogExample() {
  return (
    <WorkflowShell className="w-full max-w-xl">
      <WorkflowShellHeader>Run log</WorkflowShellHeader>
      <WorkflowShellCard className="py-2">
        <WorkflowRunLog entries={LOG} />
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
