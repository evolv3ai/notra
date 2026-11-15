import {
  TOOLTIP_MOVE_DURATION_S,
  TOOLTIP_MOVE_EASING,
} from "@/constants/chart-tooltip";

const SIZE_MOTION_SETTLE_MS = 300;

type TooltipContent = {
  el?: HTMLElement;
  setContent: (content: unknown, ...rest: unknown[]) => void;
};

type ChartWithTooltipView = {
  _componentsViews?: { type?: string; _tooltipContent?: TooltipContent }[];
};

const patchedTooltipContents = new WeakSet<object>();

// Any childList mutation in the document costs a full style recalc on the
// dashboard (its :has() rules make every insertion invalidate the whole tree,
// ~15 ms). ECharts' HTML tooltip empties and re-appends the element returned
// by the formatter on every data-index change, so scrubbing a dense series
// paid that recalc each frame. Skip the re-append when the formatter handed
// back the element that is already mounted; its content is morphed in place.
export function keepTooltipContentMounted(chart: unknown) {
  const views = (chart as ChartWithTooltipView)._componentsViews ?? [];
  for (const view of views) {
    const content = view?._tooltipContent;
    if (!content) {
      continue;
    }
    const proto = Object.getPrototypeOf(content) as TooltipContent | null;
    if (!proto || patchedTooltipContents.has(proto)) {
      continue;
    }
    patchedTooltipContents.add(proto);
    const setContent = proto.setContent;
    proto.setContent = function (
      this: TooltipContent,
      next: unknown,
      ...rest: unknown[]
    ) {
      const el = this.el;
      if (
        el &&
        next instanceof HTMLElement &&
        el.childNodes.length === 1 &&
        el.firstChild === next
      ) {
        return;
      }
      setContent.call(this, next, ...rest);
    };
  }
}

function morphAttributes(target: Element, source: Element) {
  for (const attr of Array.from(target.attributes)) {
    if (!source.hasAttribute(attr.name)) {
      target.removeAttribute(attr.name);
    }
  }
  for (const attr of Array.from(source.attributes)) {
    if (target.getAttribute(attr.name) !== attr.value) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

// Updates text and attributes in place and only touches the tree where the
// structure actually differs (rows added or removed), so a scrub across
// same-shaped tooltips never inserts nodes.
function morphChildren(target: Node, source: Node) {
  const next = Array.from(source.childNodes);
  for (const [index, sourceChild] of next.entries()) {
    const targetChild = target.childNodes[index];
    if (!targetChild) {
      target.appendChild(sourceChild);
      continue;
    }
    if (
      targetChild.nodeType !== sourceChild.nodeType ||
      targetChild.nodeName !== sourceChild.nodeName
    ) {
      targetChild.replaceWith(sourceChild);
      continue;
    }
    if (targetChild instanceof Element && sourceChild instanceof Element) {
      morphAttributes(targetChild, sourceChild);
      morphChildren(targetChild, sourceChild);
    } else if (targetChild.nodeValue !== sourceChild.nodeValue) {
      targetChild.nodeValue = sourceChild.nodeValue;
    }
  }
  while (target.childNodes.length > next.length) {
    target.lastChild?.remove();
  }
}

export function withTooltipSizeMotion(formatter: (params: unknown) => string) {
  let container: HTMLDivElement | undefined;
  let template: HTMLTemplateElement | undefined;
  let animation: Animation | undefined;
  let lastHtml = "";
  let lastChangeAt = 0;

  return (params: unknown): string | HTMLElement => {
    const html = formatter(params);
    if (!html || typeof document === "undefined") {
      animation?.cancel();
      lastHtml = "";
      return html;
    }
    container ??= document.createElement("div");
    if (html === lastHtml && container.firstElementChild) {
      return container;
    }
    const now = performance.now();
    const settled = now - lastChangeAt > SIZE_MOTION_SETTLE_MS;
    lastChangeAt = now;
    lastHtml = html;
    const previous = container.firstElementChild?.getBoundingClientRect();
    animation?.cancel();
    container.style.width = "";
    container.style.height = "";
    template ??= document.createElement("template");
    template.innerHTML = html;
    morphChildren(container, template.content);
    const surface = container.firstElementChild;
    if (
      settled &&
      surface instanceof HTMLElement &&
      previous &&
      previous.width > 0 &&
      previous.height > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const next = surface.getBoundingClientRect();
      container.style.width = `${next.width}px`;
      container.style.height = `${next.height}px`;
      if (previous.width !== next.width || previous.height !== next.height) {
        queueMicrotask(() => {
          if (
            container?.firstElementChild !== surface ||
            !container.isConnected
          ) {
            return;
          }
          animation = surface.animate(
            [
              {
                "--ec-tooltip-scale-x": previous.width / next.width,
                "--ec-tooltip-scale-y": previous.height / next.height,
              },
              { "--ec-tooltip-scale-x": 1, "--ec-tooltip-scale-y": 1 },
            ],
            {
              duration: TOOLTIP_MOVE_DURATION_S * 1000,
              easing: TOOLTIP_MOVE_EASING,
            }
          );
        });
      }
    }
    return container;
  };
}
