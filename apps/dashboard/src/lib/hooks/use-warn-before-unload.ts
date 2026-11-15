import { useEffect } from "react";

import { registerBeforeUnloadGuard } from "@/utils/before-unload";

export function useWarnBeforeUnload(active: boolean, onBlocked?: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }
    return registerBeforeUnloadGuard((event) => {
      event.preventDefault();
      event.returnValue = "";
      onBlocked?.();
    });
  }, [active, onBlocked]);
}
