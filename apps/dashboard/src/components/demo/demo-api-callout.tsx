"use client";

import { ApiIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { useTranslations } from "use-intl";

import { useDemoPlayground } from "@/components/demo/demo-playground-context";

export function DemoApiCallout() {
  const t = useTranslations("demo.apiCallout");
  const playground = useDemoPlayground();
  if (!playground) {
    return null;
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <Button onClick={() => playground.openPlayground("console")}>
        <HugeiconsIcon icon={ApiIcon} />
        {t("open")}
      </Button>
    </div>
  );
}
