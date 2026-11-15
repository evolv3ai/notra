"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TABLE_BODY_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { CodeSnippet } from "@/components/geo/code-snippet";
import {
  SITES_DOCS_URL,
  SITES_EMPTY_EXAMPLE_FILENAME,
  SITES_EMPTY_EXAMPLE_POST,
  SITES_EMPTY_POINTS,
  SITES_EMPTY_PUSH_COMMAND,
} from "@/constants/sites";
import { cn } from "@/lib/utils";
import type { SitesEmptyStateProps } from "@/types/components/sites";

export function SitesEmptyState({ newSiteHref }: SitesEmptyStateProps) {
  const t = useTranslations("sites");

  return (
    <section className="border-shell-border bg-shell overflow-hidden rounded-2xl border px-0.5 pt-0.5">
      <div className={cn(TABLE_BODY_CLASS, "grid gap-6 p-5 md:grid-cols-2")}>
        <div className="flex flex-col">
          <h2 className="text-base font-semibold tracking-tight">
            {t("empty.title")}
          </h2>
          <ul className="text-muted-foreground mt-4 space-y-2.5 text-sm">
            {SITES_EMPTY_POINTS.map(({ key, icon }) => (
              <li className="flex gap-2.5" key={key}>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  icon={icon}
                  strokeWidth={1.5}
                />
                <span className="text-pretty">{t(`empty.points.${key}`)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2 md:mt-auto md:pt-6">
            {newSiteHref ? (
              <Link
                className={buttonVariants({ size: "sm" })}
                href={newSiteHref}
              >
                <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
                {t("newSite")}
              </Link>
            ) : null}
            <a
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={SITES_DOCS_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("empty.documentation")}
            </a>
          </div>
        </div>
        <CodeSnippet
          code={SITES_EMPTY_EXAMPLE_POST}
          filename={SITES_EMPTY_EXAMPLE_FILENAME}
        />
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-2.5 md:flex-row md:items-center md:gap-4">
        <div className="shrink-0 text-xs">
          <p className="text-foreground font-medium">{t("empty.push.title")}</p>
          <p className="text-muted-foreground">{t("empty.push.description")}</p>
        </div>
        <CodeSnippet
          className="bg-background min-w-0 flex-1"
          code={SITES_EMPTY_PUSH_COMMAND}
          label={t("empty.push.title")}
          variant="command"
        />
      </div>
    </section>
  );
}
