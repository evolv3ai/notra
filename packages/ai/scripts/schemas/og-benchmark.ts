import { z } from "zod";

const scores = z.object({
  brandFidelity: z.number().min(0).max(10),
  typography: z.number().min(0).max(10),
  composition: z.number().min(0).max(10),
  defects: z.array(z.string()).max(8),
});

export const ogBenchmarkReviewSchema = z.object({
  a: scores,
  b: scores,
  winner: z.enum(["A", "B", "tie"]),
  reason: z.string().max(1500),
});
