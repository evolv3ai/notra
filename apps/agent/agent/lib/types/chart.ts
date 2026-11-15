import type { z } from "zod";

import type { chartInputSchema } from "../schemas/chart";

export type ChartInput = z.infer<typeof chartInputSchema>;
