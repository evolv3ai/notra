function snapItems(container: HTMLElement): HTMLElement[] {
  return [...container.children]
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .toSorted((a, b) => a.offsetLeft - b.offsetLeft);
}

function snapPadding(container: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(container).scrollPaddingLeft) || 0;
}

export function activeSnapIndex(container: HTMLElement): number {
  const items = snapItems(container);
  const maxScroll = container.scrollWidth - container.clientWidth;
  if (container.scrollLeft >= maxScroll - 2) {
    return items.length - 1;
  }
  const start = container.scrollLeft + snapPadding(container);
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [index, item] of items.entries()) {
    const distance = Math.abs(item.offsetLeft - start);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function scrollToSnapIndex(container: HTMLElement, index: number) {
  const item = snapItems(container)[index];
  if (!item) {
    return;
  }
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  container.scrollTo({
    left: item.offsetLeft - snapPadding(container),
    behavior: reduceMotion ? "auto" : "smooth",
  });
}
