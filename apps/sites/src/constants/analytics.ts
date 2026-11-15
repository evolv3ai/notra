export const ANALYTICS_EVENT_MAX_BYTES = 4096;

export const ANALYTICS_SCRIPT_CACHE_CONTROL = "public, max-age=3600";

export const ANALYTICS_SCRIPT = `(() => {
  const script = document.currentScript;
  const endpoint = script && script.dataset.endpoint;
  if (!endpoint || window.top !== window || !navigator.sendBeacon) return;
  if ("view" in script.dataset) {
    navigator.sendBeacon(
      endpoint,
      JSON.stringify({ k: "view", p: location.pathname + location.search, r: document.referrer })
    );
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  let total = 0;
  let depth = 0;
  let reported = 0;
  let shownAt = document.visibilityState === "visible" ? performance.now() : null;
  const measureScroll = () => {
    const root = document.documentElement;
    const room = root.scrollHeight - window.innerHeight;
    const reached = room > 0 ? Math.round(Math.min(1, window.scrollY / room) * 100) : 100;
    if (reached > depth) depth = reached;
  };
  const report = () => {
    if (shownAt !== null) {
      total += performance.now() - shownAt;
      shownAt = null;
    }
    if (total - reported < 1) return;
    reported = total;
    navigator.sendBeacon(
      endpoint,
      JSON.stringify({ v: id, p: location.pathname, ms: Math.round(total), sd: depth })
    );
  };
  measureScroll();
  addEventListener("scroll", measureScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") report();
    else if (shownAt === null) shownAt = performance.now();
  });
  addEventListener("pagehide", report);
})();
`;
