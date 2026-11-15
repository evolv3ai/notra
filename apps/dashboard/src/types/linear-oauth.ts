import type { z } from "zod";

import type { linearOAuthStateSchema } from "@/schemas/linear-oauth";

export type LinearOAuthState = z.infer<typeof linearOAuthStateSchema>;
