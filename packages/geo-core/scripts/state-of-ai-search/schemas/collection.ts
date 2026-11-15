import { z } from "zod";

export const reportOlostepCheckpointSchema = z.object({
  engine: z.string(),
  prompt: z.string(),
  batchId: z.string().min(1).optional(),
});
export const reportContextSearchSchema = z.object({
  query: z.string().min(1).max(1000),
});

export const reportContextCheckpointSchema = z.object({
  engine: z.string(),
  prompt: z.string(),
  answer: z
    .object({
      text: z.string(),
      sources: z.array(
        z.object({
          url: z.string(),
          title: z.string().nullable(),
          domain: z.string(),
        })
      ),
      searchQueries: z.array(z.string()),
      present: z.boolean(),
      overview: z.null(),
      providerMetadata: z.unknown(),
    })
    .optional(),
});
