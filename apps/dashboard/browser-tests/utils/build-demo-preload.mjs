import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEMO_PRELOAD_INVOCATION } from "../constants/demo-preload.ts";

const source = readFileSync(
  new URL("../../src/components/demo/demo-human-check.tsx", import.meta.url),
  "utf8"
);
const invocationCount = source.split(DEMO_PRELOAD_INVOCATION).length - 1;
if (invocationCount !== 1) {
  throw new Error(
    `Demo preload baseline drift: expected exactly one ${DEMO_PRELOAD_INVOCATION}, found ${invocationCount}`
  );
}
const baseline = source.replace(DEMO_PRELOAD_INVOCATION, "");

for (const variant of ["baseline", "preload"]) {
  for (const target of ["browser", "bun"]) {
    const result = await Bun.build({
      entrypoints: [
        fileURLToPath(
          new URL(
            `../fixtures/demo-preload-${target === "browser" ? "client" : "server"}.tsx`,
            import.meta.url
          )
        ),
      ],
      target,
      outdir: join(process.argv[2], variant, target),
      define: { "process.env.NODE_ENV": '"development"' },
      plugins:
        variant === "baseline"
          ? [
              {
                name: "baseline-component",
                setup(builder) {
                  builder.onLoad(
                    { filter: /\/demo-human-check\.tsx$/ },
                    () => ({ contents: baseline, loader: "tsx" })
                  );
                },
              },
            ]
          : [],
    });
    if (!result.success) {
      throw new AggregateError(
        result.logs,
        "Demo preload fixture build failed"
      );
    }
  }
}
