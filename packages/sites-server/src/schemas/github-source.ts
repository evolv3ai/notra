import { z } from "zod";

export const githubSourceTreeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(
    z.object({
      path: z.string().min(1).max(4096),
      mode: z.string(),
      type: z.enum(["blob", "tree", "commit"]),
      sha: z.string().regex(/^[a-f0-9]{40}$/),
      size: z.number().int().nonnegative().optional(),
    })
  ),
});
