import type { z } from "zod";

import type { generationConfigSchema } from "../schemas/generation-config";

export type GenerationConfig = z.infer<typeof generationConfigSchema>;
