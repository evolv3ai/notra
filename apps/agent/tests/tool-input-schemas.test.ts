import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const toolDirectories = [
  "agent/tools",
  ...readdirSync(join(import.meta.dir, "../agent/subagents")).map(
    (name) => `agent/subagents/${name}/tools`
  ),
];

describe("tool input schemas", () => {
  for (const directory of toolDirectories) {
    const files = readdirSync(join(import.meta.dir, "..", directory)).filter(
      (file) => file.endsWith(".ts")
    );

    for (const file of files) {
      test(`${directory}/${file} serializes to a top-level object`, async () => {
        const { default: tool } = await import(
          join(import.meta.dir, "..", directory, file)
        );
        const schema = tool?.inputSchema;
        if (!schema) {
          return;
        }
        const json = schema["~standard"].jsonSchema.input({
          target: "draft-07",
        });
        expect(json.type).toBe("object");
      });
    }
  }
});
