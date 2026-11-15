import { z } from "zod";

import { MAX_DIAGRAM_SCENE_ELEMENTS } from "@/constants/diagram-editor";

export const saveDiagramSceneSchema = z.object({
  scene: z.object({
    elements: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(MAX_DIAGRAM_SCENE_ELEMENTS),
    appState: z
      .object({ viewBackgroundColor: z.string().max(40).optional() })
      .optional(),
  }),
  revision: z.number().int().min(0),
});
