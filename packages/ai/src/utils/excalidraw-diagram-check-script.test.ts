import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  DIAGRAM_CHECK_SCRIPT,
  DIAGRAM_SPEC_PATH,
} from "../constants/excalidraw-diagram";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "diagram-check-"));
  writeFileSync(join(dir, "check.mjs"), DIAGRAM_CHECK_SCRIPT);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function check(spec: unknown) {
  writeFileSync(
    join(dir, DIAGRAM_SPEC_PATH),
    typeof spec === "string" ? spec : JSON.stringify(spec)
  );
  try {
    const { stdout } = await promisify(execFile)("node", ["check.mjs"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 3000,
      killSignal: "SIGKILL",
    });
    return { exitCode: 0, output: stdout };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "number" &&
      "stdout" in error &&
      typeof error.stdout === "string"
    ) {
      return { exitCode: error.code, output: error.stdout };
    }
    throw error;
  }
}

const tidy = {
  elements: [
    { type: "text", x: 0, y: 0, text: "Webhook delivery", fontSize: 40 },
    {
      type: "rectangle",
      id: "a",
      x: 0,
      y: 120,
      width: 220,
      height: 90,
      label: "Event",
    },
    {
      type: "rectangle",
      id: "b",
      x: 420,
      y: 120,
      width: 220,
      height: 90,
      label: "Queue",
    },
    {
      type: "ellipse",
      id: "c",
      x: 840,
      y: 120,
      width: 220,
      height: 90,
      label: "Done",
    },
    {
      type: "rectangle",
      id: "d",
      x: 420,
      y: 380,
      width: 220,
      height: 90,
      label: "Retry",
    },
    { type: "arrow", start: { id: "a" }, end: { id: "b" }, label: "publish" },
    { type: "arrow", start: { id: "b" }, end: { id: "c" }, label: "deliver" },
    { type: "arrow", start: { id: "b" }, end: { id: "d" }, label: "fail" },
  ],
};

test("a tidy diagram inside the 1100x530 box passes", async () => {
  const result = await check(tidy);
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain("OK");
});

test("invalid JSON and dangling arrow ids fail with exit code 1", async () => {
  expect((await check("{ nope")).exitCode).toBe(1);

  const dangling = await check({
    elements: [
      { type: "rectangle", id: "a", x: 0, y: 0 },
      { type: "arrow", start: { id: "a" }, end: { id: "ghost" } },
    ],
  });
  expect(dangling.exitCode).toBe(1);
  expect(dangling.output).toContain(
    "end id 'ghost' is not a rectangle, ellipse, or diamond"
  );
});

test("warns about overlaps, oversized diagrams, and labels that do not fit", async () => {
  const result = await check({
    elements: [
      {
        type: "rectangle",
        id: "a",
        x: 0,
        y: 0,
        width: 200,
        height: 80,
        label: "A",
      },
      {
        type: "rectangle",
        id: "b",
        x: 230,
        y: 0,
        width: 200,
        height: 80,
        label: "B",
      },
      {
        type: "rectangle",
        id: "c",
        x: 150,
        y: 20,
        width: 200,
        height: 80,
        label: "C",
      },
      {
        type: "rectangle",
        id: "far",
        x: 2400,
        y: 0,
        width: 200,
        height: 80,
        label: "Far",
      },
      {
        type: "arrow",
        start: { id: "a" },
        end: { id: "b" },
        label: "proxy check",
      },
    ],
  });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain("overlap:");
  expect(result.output).toContain("larger than the 1100x530 box");
  expect(result.output).toContain("arrow label 'proxy check'");
});
