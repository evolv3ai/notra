"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  WorkflowTemplateCard,
  WorkflowTemplateDialog,
} from "../components/workflow-template-card";
import { WORKFLOW_TEMPLATES } from "../constants/workflow-templates";
import type { WorkflowTemplate } from "../types/workflow";

const ALL = "All";
const CATEGORIES = [
  ALL,
  ...new Set(WORKFLOW_TEMPLATES.map((item) => item.category)),
];

export default function WorkflowTemplates() {
  const [category, setCategory] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WorkflowTemplate>();
  const visible =
    category === ALL
      ? WORKFLOW_TEMPLATES
      : WORKFLOW_TEMPLATES.filter((item) => item.category === category);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Start from a template</h2>
          <p className="text-muted-foreground text-sm">
            Workflows you can run as they are or change step by step.
          </p>
        </div>
        <Tabs
          className="max-w-full overflow-x-auto"
          onValueChange={(value) => setCategory(String(value))}
          value={category}
        >
          <TabsList>
            {CATEGORIES.map((item) => (
              <TabsTrigger key={item} value={item}>
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((template) => (
          <WorkflowTemplateCard
            key={template.id}
            onUse={(next) => {
              setPreview(next);
              setOpen(true);
            }}
            template={template}
          />
        ))}
      </div>
      <WorkflowTemplateDialog
        onOpenChange={setOpen}
        onUse={(template) => {
          setOpen(false);
          toast.success(`Created “${template.title}”`);
        }}
        open={open}
        template={preview}
      />
    </div>
  );
}
