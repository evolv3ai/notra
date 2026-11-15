import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadRenderFont } from "@notra/ai/utils/render-font";

import { chartInputSchema } from "../schemas/chart";
import type { ChartInput } from "../types/chart";

export async function renderChart(input: ChartInput): Promise<Buffer> {
  const chart = chartInputSchema.parse(input);
  const [regular, bold, { Resvg }, echarts] = await Promise.all([
    loadRenderFont("Inter"),
    loadRenderFont("Inter:wght@700"),
    import("@resvg/resvg-js"),
    import("echarts"),
  ]);
  const renderer = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: 1200,
    height: 700,
  });
  let fontDirectory: string | undefined;
  try {
    fontDirectory = await mkdtemp(join(tmpdir(), "notra-chart-"));
    const regularFile = join(fontDirectory, "regular.ttf");
    const boldFile = join(fontDirectory, "bold.ttf");
    await Promise.all([
      writeFile(regularFile, Buffer.from(regular)),
      writeFile(boldFile, Buffer.from(bold)),
    ]);
    renderer.setOption({
      animation: false,
      backgroundColor: "#ffffff",
      color: ["#7c3aed", "#0284c7", "#059669", "#d97706", "#db2777", "#475569"],
      textStyle: { fontFamily: "Inter", fontSize: 16 },
      title: {
        text: chart.title,
        left: 40,
        top: 24,
        textStyle: { fontSize: 24, width: 1100, overflow: "break" },
      },
      legend: { top: 100, left: 40, right: 40, itemGap: 28 },
      grid: { left: 70, right: 40, top: 170, bottom: 110, containLabel: true },
      xAxis: {
        type: "category",
        data: chart.labels,
        axisLabel: { hideOverlap: true, width: 140, overflow: "truncate" },
      },
      yAxis: {
        type: "value",
        name: chart.yAxisLabel,
        nameGap: 24,
        scale: false,
      },
      series: chart.series.map((series) => ({
        name: series.name,
        type: chart.type,
        data: series.values,
        connectNulls: false,
        smooth: false,
        symbolSize: 7,
        barMaxWidth: 60,
      })),
      graphic: [
        {
          type: "text",
          left: 40,
          bottom: 20,
          style: {
            text: chart.source,
            fontSize: 14,
            fill: "#64748b",
            width: 1120,
            overflow: "break",
          },
        },
      ],
    });
    return new Resvg(renderer.renderToSVGString(), {
      font: {
        loadSystemFonts: false,
        defaultFontFamily: "Inter",
        fontFiles: [regularFile, boldFile],
      },
    })
      .render()
      .asPng();
  } finally {
    renderer.dispose();
    if (fontDirectory) {
      await rm(fontDirectory, { recursive: true, force: true });
    }
  }
}
