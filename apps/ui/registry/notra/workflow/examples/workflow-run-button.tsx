"use client";

import { useEffect, useState } from "react";

import { WorkflowRunButton } from "../components/workflow-run-button";
import type { WorkflowRunPhase } from "../types/workflow";

const DURATION_MS = 4000;

export default function WorkflowRunButtonExample() {
  const [phase, setPhase] = useState<WorkflowRunPhase>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    const started = performance.now();
    const id = window.setInterval(() => {
      const next = (performance.now() - started) / DURATION_MS;
      setProgress(Math.min(next, 1));
      if (next >= 1) {
        setPhase("done");
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [phase]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <WorkflowRunButton
        onPlay={() => {
          setProgress(0);
          setPhase("running");
        }}
        onStop={() => setPhase("idle")}
        phase={phase}
        progress={progress}
      />
      <WorkflowRunButton disabled phase="idle" />
    </div>
  );
}
