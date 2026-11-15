import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { preload } from "react-dom";

import {
  DEMO_TURNSTILE_ACTION,
  TURNSTILE_SCRIPT_SRC,
} from "@/constants/turnstile";
import { loadTurnstileScript } from "@/lib/turnstile/load-script";
import type { DemoHumanCheckProps } from "@/types/turnstile";

export function DemoHumanCheck({
  siteKey,
  failureMessage,
  onToken,
  ref,
}: DemoHumanCheckProps) {
  preload(TURNSTILE_SCRIPT_SRC, { as: "script" });

  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        onToken("");
        setFailed(false);
        if (widgetId.current !== null) {
          window.turnstile?.reset(widgetId.current);
        }
      },
    }),
    [onToken]
  );

  useEffect(() => {
    let active = true;
    loadTurnstileScript()
      .then(() => {
        if (!(active && container.current && window.turnstile)) {
          return;
        }
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action: DEMO_TURNSTILE_ACTION,
          appearance: "interaction-only",
          execution: "render",
          size: "flexible",
          callback: (token) => {
            setFailed(false);
            onToken(token);
          },
          "expired-callback": () => onToken(""),
          "timeout-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (active) {
          onToken("");
          setFailed(true);
        }
      });
    return () => {
      active = false;
      if (widgetId.current !== null) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [onToken, siteKey]);

  return (
    <div
      className="flex w-full flex-col gap-2"
      data-action={DEMO_TURNSTILE_ACTION}
    >
      <div ref={container} />
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          {failureMessage}
        </p>
      ) : null}
    </div>
  );
}
