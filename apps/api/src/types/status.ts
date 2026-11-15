import type { publicStatusResponseSchema } from "@notra/schemas/api/status";
import type { z } from "zod";

export type PublicStatusResponse = z.infer<typeof publicStatusResponseSchema>;
