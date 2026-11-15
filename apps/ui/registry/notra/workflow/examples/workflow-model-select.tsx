"use client";

import { useState } from "react";

import { WorkflowModelSelect } from "../components/workflow-model-select";

export default function WorkflowModelSelectExample() {
  const [model, setModel] = useState("claude-sonnet-5-5");
  return (
    <div className="flex w-64 flex-col gap-1.5">
      <label
        className="text-sm leading-none font-medium"
        htmlFor="model-select"
      >
        Model
      </label>
      <WorkflowModelSelect
        id="model-select"
        onValueChange={setModel}
        value={model}
      />
    </div>
  );
}
