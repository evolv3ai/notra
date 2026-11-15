import type { ECharts } from "echarts";

const CHART_RESIZE_SETTLE_MS = 150;
const CHART_REPUSH_IDLE_TIMEOUT_MS = 500;

function whenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task, {
      timeout: CHART_REPUSH_IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 0);
  return () => clearTimeout(handle);
}

export function observeChartResize(
  mount: HTMLElement,
  chart: ECharts,
  callbacks: { onResized?: () => void; onSettled?: () => void } = {}
): () => void {
  const { onResized, onSettled } = callbacks;
  let frame = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelIdle: (() => void) | undefined;

  const observer = new ResizeObserver(() => {
    if (frame !== 0) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (
        chart.isDisposed() ||
        (mount.clientWidth === chart.getWidth() &&
          mount.clientHeight === chart.getHeight())
      ) {
        return;
      }
      chart.resize({ animation: { duration: 0 } });
      onResized?.();
      if (onSettled) {
        clearTimeout(settleTimer);
        cancelIdle?.();
        settleTimer = setTimeout(() => {
          cancelIdle = whenIdle(() => {
            if (!chart.isDisposed()) {
              onSettled();
            }
          });
        }, CHART_RESIZE_SETTLE_MS);
      }
    });
  });
  observer.observe(mount);

  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(settleTimer);
    cancelIdle?.();
  };
}
