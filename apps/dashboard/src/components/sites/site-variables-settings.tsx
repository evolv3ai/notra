"use client";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Fragment } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  SiteSettingsHint,
  SiteSettingsValue,
} from "@/components/sites/site-settings-item";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";

export function SiteVariablesCount() {
  const state = useSiteWorkspace();
  const t = useTranslations("sites.settings");
  if (!state) {
    return null;
  }
  const count = state.variableRows.filter((row) => row.name.trim()).length;
  return (
    <SiteSettingsValue>{t("variablesCount", { count })}</SiteSettingsValue>
  );
}

export function SiteVariablesSettings() {
  const state = useSiteWorkspace();
  const t = useTranslations("sites.variables");
  const workspace = useTranslations("sites.design.workspace");
  if (!state) {
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        {workspace("loading")}
      </p>
    );
  }
  const { variableRows: rows, updateVariables } = state;
  return (
    <div
      className="max-w-2xl space-y-4"
      inert={state.readOnly}
      aria-busy={state.readOnly}
    >
      {rows.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] items-center gap-2">
          <span className="text-muted-foreground px-1 text-xs font-medium">
            {t("name")}
          </span>
          <span className="text-muted-foreground px-1 text-xs font-medium">
            {t("value")}
          </span>
          <span />
          {rows.map((row, index) => (
            <Fragment key={row.id}>
              <Input
                aria-label={t("nameLabel", { number: index + 1 })}
                autoComplete="off"
                value={row.name}
                placeholder="product_name"
                maxLength={40}
                onChange={(event) =>
                  updateVariables(
                    rows.map((item) =>
                      item.id === row.id
                        ? { ...item, name: event.target.value }
                        : item
                    )
                  )
                }
              />
              <Input
                aria-label={t("valueLabel", { number: index + 1 })}
                value={row.value}
                placeholder="Acme"
                maxLength={500}
                onChange={(event) =>
                  updateVariables(
                    rows.map((item) =>
                      item.id === row.id
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
              />
              <Button
                aria-label={t("removeLabel", { number: index + 1 })}
                size="icon-sm"
                variant="ghost"
                onClick={() =>
                  updateVariables(rows.filter((item) => item.id !== row.id))
                }
              >
                <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} />
              </Button>
            </Fragment>
          ))}
        </div>
      ) : null}
      {state.variableError ? (
        <p role="alert" className="text-destructive text-xs">
          {t(state.variableError)}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          updateVariables([
            ...rows,
            { id: crypto.randomUUID(), name: "", value: "" },
          ])
        }
      >
        <HugeiconsIcon aria-hidden="true" icon={Add01Icon} />
        {t("add")}
      </Button>
      <SiteSettingsHint>{t("hint")}</SiteSettingsHint>
    </div>
  );
}
