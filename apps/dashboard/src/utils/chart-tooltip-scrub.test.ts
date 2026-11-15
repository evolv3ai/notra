import { expect, test } from "bun:test";

import { tooltipBaseOption } from "@/components/evilcharts/ui/echarts-tooltip";
import { TOOLTIP_MOVE_DURATION_S } from "@/constants/chart-tooltip";

test.each([true, false])(
  "tooltip motion only bypasses ECharts position throttling when scrub=%s",
  (scrub) => {
    const option = tooltipBaseOption({
      present: true,
      cursor: false,
      tokens: {
        mutedForeground: "#777",
        border: "#ccc",
        foreground: "#111",
        background: "#fff",
      },
      position: "fixed",
      axisPointerColor: "#777",
      strokeWidth: 1,
      scrub,
    });

    const duration = scrub ? 0 : TOOLTIP_MOVE_DURATION_S;
    expect(option.transitionDuration).toBe(duration);
    expect(option.extraCssText).toContain(`transition:transform ${duration}s`);
    expect(option.showDelay).toBe(0);
    expect(option.trigger).toBe("axis");
  }
);
