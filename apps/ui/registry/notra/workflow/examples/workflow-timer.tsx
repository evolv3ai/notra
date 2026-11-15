"use client";

import { useEffect, useState } from "react";

import { WorkflowTimer } from "../components/workflow-timer";

export default function WorkflowTimerExample() {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(
      () => setMs((performance.now() - started) % 90_000),
      100
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-start gap-3 text-sm">
      <span className="flex items-center gap-3">
        Crawling 214 pages <WorkflowTimer ms={ms} running />
      </span>
      <span className="flex items-center gap-3">
        Classified 37 listicles <WorkflowTimer ms={2240} />
      </span>
      <span className="flex items-center gap-3">
        Weekly visibility scan <WorkflowTimer ms={754_000} />
      </span>
    </div>
  );
}
