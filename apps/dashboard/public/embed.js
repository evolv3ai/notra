/*
 * Notra embeds: sizes every <iframe data-notra-embed> to its content.
 * The frame posts { type: "notra:embed:resize", height } whenever its content
 * changes size; only messages from the matching frame and origin are applied.
 */
(() => {
  if (window.__notraEmbed) {
    return;
  }
  window.__notraEmbed = true;
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (
      !data ||
      data.type !== "notra:embed:resize" ||
      typeof data.height !== "number"
    ) {
      return;
    }
    for (const frame of document.querySelectorAll("iframe[data-notra-embed]")) {
      if (frame.contentWindow !== event.source) {
        continue;
      }
      if (new URL(frame.src, location.href).origin !== event.origin) {
        return;
      }
      frame.style.height = `${Math.max(0, Math.ceil(data.height))}px`;
      return;
    }
  });
})();
