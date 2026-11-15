import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { NUKE_CLICKS, NUKE_CLICK_WINDOW_MS } from "@/constants/nuke-easter-egg";
import { nukePage } from "@/utils/nuke-easter-egg";

export function useNukeEasterEgg<T extends HTMLElement>() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) {
      return;
    }

    const controller = new AbortController();
    let count = 0;
    let last = 0;
    let running = false;
    const onClick = (event: MouseEvent) => {
      if (running) {
        return;
      }
      count = event.timeStamp - last > NUKE_CLICK_WINDOW_MS ? 1 : count + 1;
      last = event.timeStamp;
      if (count < NUKE_CLICKS) {
        return;
      }

      count = 0;
      running = true;
      nukePage(controller.signal)
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };

    element.addEventListener("click", onClick);
    return () => {
      controller.abort();
      element.removeEventListener("click", onClick);
    };
  }, [reduceMotion]);

  return ref;
}
