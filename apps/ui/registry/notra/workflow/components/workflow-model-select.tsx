"use client";

import { cn } from "cn";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../select/components/select";
import { WORKFLOW_MODELS } from "../constants/workflow";
import type { WorkflowModelSelectProps } from "../types/workflow";
import { WorkflowLogo } from "./workflow-logo";

export const WorkflowModelSelect = ({
  className,
  defaultValue,
  disabled,
  id,
  models = WORKFLOW_MODELS,
  onValueChange,
  value,
}: WorkflowModelSelectProps) => (
  <Select
    defaultValue={defaultValue}
    disabled={disabled}
    onValueChange={(next) => {
      if (typeof next === "string") {
        onValueChange?.(next);
      }
    }}
    value={value}
  >
    <SelectTrigger
      className={cn("w-full", className)}
      data-slot="workflow-model-select"
      id={id}
    >
      <SelectValue>
        {(current: string | null) => {
          const model = models.find((item) => item.id === current);
          return model ? (
            <span className="flex items-center gap-2">
              <WorkflowLogo className="size-3.5" name={model.logo} />
              {model.label}
            </span>
          ) : (
            "Choose a model"
          );
        }}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {models.map((model) => (
        <SelectItem key={model.id} value={model.id}>
          <WorkflowLogo className="size-3.5" name={model.logo} />
          {model.label}
          <span className="text-muted-foreground ml-auto pl-3 text-xs">
            {model.provider}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
