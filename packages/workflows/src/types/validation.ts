import type * as z from "zod";

import type { WorkflowBlockManifest } from "./blocks";
import type { WorkflowDefinition } from "./graph";

export interface WorkflowValidationBlock extends WorkflowBlockManifest {
  configSchema?: z.ZodType;
}

export interface WorkflowValidationOptions {
  blocks: Record<string, WorkflowValidationBlock>;
}

export interface WorkflowBundleOptions extends WorkflowValidationOptions {
  definitions: Record<string, WorkflowDefinition>;
}
