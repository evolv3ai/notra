import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { sidebarResizeWorker } from "./constants/sidebar-resize";

for (const scenario of [
  "pointerup",
  "lostcapture",
  "cancel",
  "fallback",
  "keyboard",
  "doubleclick",
  "collapse",
  "reexpand",
]) {
  test(`SidebarResizeHandle preserves ${scenario} resize behavior`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--eval",
        sidebarResizeWorker,
        "components/dashboard/sidebar-resize-handle.tsx",
        "SidebarResizeHandle",
        "sidebar-resize",
        scenario,
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        timeout: 30_000,
        encoding: "utf8",
      }
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
}
