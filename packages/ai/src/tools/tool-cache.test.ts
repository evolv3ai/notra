import assert from "node:assert/strict";
import { test } from "node:test";

import { getAICachedTools } from "./tool-cache";

test("identical concurrent tool calls share one execution; opted-out results are not kept", async () => {
  const cached = getAICachedTools({
    organizationId: "org-tool-cache",
    namespace: "tool-cache-test",
  });
  let executions = 0;
  const tool = cached(
    {
      execute: async (params: unknown) => {
        executions += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { params, empty: (params as { q: string }).q === "empty" };
      },
    },
    { shouldCache: (_params, result) => !(result as { empty: boolean }).empty }
  );

  const results = await Promise.all(
    Array.from({ length: 3 }, () => tool.execute({ q: "hit" }))
  );
  assert.equal(executions, 1);
  assert.ok(results.every((result) => result === results[0]));
  await tool.execute({ q: "hit" });
  assert.equal(executions, 1);

  await tool.execute({ q: "empty" });
  await tool.execute({ q: "empty" });
  assert.equal(executions, 3);
});
