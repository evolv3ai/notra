import type { z } from "zod";

import type { githubSourceTreeSchema } from "../schemas/github-source";

export type GithubSourceEntry = z.infer<
  typeof githubSourceTreeSchema
>["tree"][number];
