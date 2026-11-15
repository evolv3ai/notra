import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { echartsSelectionWorker } from "./constants/echarts-selection";
import { reactDoctorEventCases } from "./constants/react-doctor-events";

for (const [file, component] of reactDoctorEventCases.filter(
  ([, , mode]) => mode === "chart"
)) {
  test(`${component} mounted selection handler uses the latest callback`, () => {
    const result = spawnSync(
      process.execPath,
      ["--eval", echartsSelectionWorker, file, component, "selection-callback"],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        timeout: 30_000,
        encoding: "utf8",
      }
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
}
