export const DEMO_PRELOAD_INVOCATION =
  'preload(TURNSTILE_SCRIPT_SRC, { as: "script" });';
export const DEMO_PRELOAD_BASELINE_STRATEGY =
  "Current demo-human-check.tsx with exactly one expected preload invocation removed; all other widget behavior unchanged";
export const DEMO_PRELOAD_SAMPLES = 5;
export const DEMO_PRELOAD_HYDRATION_DELAY_MS = 400;
export const DEMO_PRELOAD_SCRIPT_DELAY_MS = 250;
export const DEMO_PRELOAD_STUB = `
performance.mark("script-executed");
window.turnstile = {
  render(element, options) {
    performance.mark("widget-ready");
    queueMicrotask(() => options.callback("synthetic-token"));
    return "synthetic-widget";
  },
  reset() {},
  remove() {}
};`;
