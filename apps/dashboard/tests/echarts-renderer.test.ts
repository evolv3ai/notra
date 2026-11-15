import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { echartsRendererWorker } from "./constants/echarts-renderer";

for (const renderer of ["default", "canvas", "svg"]) {
  test(`EChartsAreaChart initializes ${renderer === "default" ? "canvas by default" : `the requested ${renderer} renderer`} and cleans up`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--eval",
        echartsRendererWorker,
        "components/evilcharts/charts/echarts-area-chart.tsx",
        "EChartsAreaChart",
        "renderer",
        renderer,
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
