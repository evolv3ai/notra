import { z } from "zod";

export const stripeMetadataValueSchema = z.string().min(1).max(500);
