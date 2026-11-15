import { useEffect } from "react";

import { withAppTracking } from "@/utils/app-tracking";

function decorateAppLink(event: MouseEvent) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const anchor = event.target.closest("a[href]");
  if (anchor instanceof HTMLAnchorElement) {
    anchor.href = withAppTracking(anchor.href);
  }
}

export function AppLinkTracking() {
  useEffect(() => {
    document.addEventListener("click", decorateAppLink, true);
    document.addEventListener("auxclick", decorateAppLink, true);
    document.addEventListener("contextmenu", decorateAppLink, true);
    return () => {
      document.removeEventListener("click", decorateAppLink, true);
      document.removeEventListener("auxclick", decorateAppLink, true);
      document.removeEventListener("contextmenu", decorateAppLink, true);
    };
  }, []);
  return null;
}
