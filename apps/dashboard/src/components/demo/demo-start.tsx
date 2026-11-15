"use client";

import { Button } from "@notra/ui/components/ui/button";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { DemoHumanCheck } from "@/components/demo/demo-human-check";
import type { DemoSandboxCreateResponse, DemoStartProps } from "@/types/demo";
import type { TurnstileHandle } from "@/types/turnstile";
import { resolveDemoLanding } from "@/utils/demo-return-to";

async function createSandbox(
  token: string
): Promise<DemoSandboxCreateResponse> {
  const response = await fetch("/api/demo/sandbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "cf-turnstile-response": token,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!response.ok) {
    throw new Error(`Sandbox creation failed with ${response.status}`);
  }
  return response.json();
}

export function DemoStart({ returnTo, turnstileSiteKey }: DemoStartProps) {
  const t = useTranslations("demo.start");
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState("");
  const inFlight = useRef(false);
  const humanCheck = useRef<TurnstileHandle>(null);

  const start = useCallback(() => {
    if (!token || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setFailed(false);
    createSandbox(token)
      .then(({ slug }) => {
        window.location.replace(resolveDemoLanding(returnTo, slug));
      })
      .catch(() => {
        setFailed(true);
        inFlight.current = false;
        humanCheck.current?.reset();
      });
  }, [returnTo, token]);

  useEffect(() => {
    if (token && !failed) {
      start();
    }
  }, [token, failed, start]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <div aria-live="polite" className="flex flex-col items-center gap-3">
        {!turnstileSiteKey ? (
          <>
            <h1 className="text-lg font-semibold">
              {t("verificationUnavailableTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("verificationUnavailableDescription")}
            </p>
          </>
        ) : null}
        {turnstileSiteKey && failed ? (
          <>
            <h1 className="text-lg font-semibold">{t("errorTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("errorDescription")}
            </p>
            <Button disabled={!token} onClick={start} variant="outline">
              {t("retry")}
            </Button>
          </>
        ) : null}
        {turnstileSiteKey && !failed ? (
          <>
            <Spinner className="text-muted-foreground size-5" />
            <h1 className="text-lg font-semibold">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </>
        ) : null}
      </div>
      {turnstileSiteKey ? (
        <DemoHumanCheck
          ref={humanCheck}
          siteKey={turnstileSiteKey}
          failureMessage={t("verificationFailed")}
          onToken={setToken}
        />
      ) : null}
    </div>
  );
}
