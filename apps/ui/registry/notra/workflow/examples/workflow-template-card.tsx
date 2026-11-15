"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  WorkflowTemplateCard,
  WorkflowTemplateDialog,
} from "../components/workflow-template-card";
import {
  LISTICLE_OUTREACH_WORKFLOW,
  VISIBILITY_MONITOR_WORKFLOW,
} from "../constants/workflow-templates";
import type { WorkflowTemplate } from "../types/workflow";

export default function WorkflowTemplateCardExample() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WorkflowTemplate>();
  return (
    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
      {[LISTICLE_OUTREACH_WORKFLOW, VISIBILITY_MONITOR_WORKFLOW].map(
        (template) => (
          <WorkflowTemplateCard
            key={template.id}
            onUse={(next) => {
              setPreview(next);
              setOpen(true);
            }}
            template={template}
          />
        )
      )}
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
