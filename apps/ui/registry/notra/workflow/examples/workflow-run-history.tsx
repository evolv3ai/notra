"use client";

import { useState } from "react";

import { WorkflowRunHistory } from "../components/workflow-run-history";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WORKFLOW_RUNS } from "../constants/workflow-runs";

export default function WorkflowRunHistoryExample() {
  const [selected, setSelected] = useState(WORKFLOW_RUNS[1]?.id);
  return (
    <WorkflowShell className="w-full max-w-sm">
      <WorkflowShellHeader>Runs</WorkflowShellHeader>
      <WorkflowShellCard className="p-1.5">
        <WorkflowRunHistory
          onSelect={setSelected}
          runs={WORKFLOW_RUNS}
          selectedId={selected}
        />
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
