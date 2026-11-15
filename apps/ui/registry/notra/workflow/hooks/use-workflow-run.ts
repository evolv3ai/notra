"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WORKFLOW_TICK_MS } from "../constants/workflow";
import { getEdgeState, getNodeState, scheduleRun } from "../lib/workflow";
import type {
  WorkflowEdgeData,
  WorkflowNodeData,
  WorkflowRun,
  WorkflowRunPhase,
} from "../types/workflow";

export const useWorkflowRun = (
  nodes: WorkflowNodeData[],
  edges: WorkflowEdgeData[]
): WorkflowRun => {
  const liveSchedule = useMemo(() => scheduleRun(nodes, edges), [nodes, edges]);
  const [phase, setPhase] = useState<WorkflowRunPhase>("idle");
  const [runSchedule, setRunSchedule] = useState(liveSchedule);
  const schedule = phase === "idle" ? liveSchedule : runSchedule;
  const [tickMs, setElapsedMs] = useState(0);
  const elapsedMs = phase === "done" ? schedule.totalMs : tickMs;
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      if (elapsed >= schedule.totalMs) {
        setElapsedMs(schedule.totalMs);
        setPhase("done");
        return;
      }
      setElapsedMs(elapsed);
    }, WORKFLOW_TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, schedule.totalMs]);

  const play = useCallback(() => {
    setRunSchedule(liveSchedule);
    startedAt.current = performance.now();
    setElapsedMs(0);
    setPhase("running");
  }, [liveSchedule]);

  const stop = useCallback(() => {
    setElapsedMs(0);
    setPhase("idle");
  }, []);

  const nodeState = useCallback(
    (id: string) =>
      getNodeState(
        nodes.find((node) => node.id === id),
        schedule,
        phase,
        elapsedMs
      ),
    [nodes, schedule, phase, elapsedMs]
  );

  const edgeState = useCallback(
    (id: string) => getEdgeState(id, schedule, phase, elapsedMs),
    [schedule, phase, elapsedMs]
  );

  return {
    edgeState,
    elapsedMs,
    nodeState,
    phase,
    play,
    schedule,
    stop,
    totalMs: schedule.totalMs,
  };
};
