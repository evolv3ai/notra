import { z } from "zod";

export const dashboardErrorSchema = z.object({ error: z.string() });
