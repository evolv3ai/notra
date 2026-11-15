"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GeoContentBrief } from "@notra/ai/types/geo-writer";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { useBlogPostSubtypeLabels } from "@/lib/hooks/use-blog-post-subtype-labels";
import { isBlogPostSubtype } from "@/utils/content-subtype";

function PlanSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function ContentPlanReadView({
  brief,
}: {
  brief: GeoContentBrief | undefined;
}) {
  return brief ? <PlanReadContent brief={brief} /> : null;
}

function PlanReadContent({ brief }: { brief: GeoContentBrief }) {
  const t = useTranslations("content.plan");
  const tCommon = useTranslations("common.labels");
  const tContentShared = useTranslations("content.shared");
  const subtypeLabels = useBlogPostSubtypeLabels();
  const subtype = isBlogPostSubtype(brief.contentSubtype)
    ? subtypeLabels[brief.contentSubtype]
    : brief.contentSubtype;
  const properties = [
    { label: tCommon("type"), value: subtype },
    { label: t("audience.label"), value: brief.audience },
    { label: tCommon("intent"), value: brief.intent },
    { label: t("jobToBeDone.label"), value: brief.jobToBeDone },
  ];

  return (
    <article className="mx-auto w-full max-w-3xl space-y-12">
      <header className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-pretty md:text-4xl">
            {brief.workingTitle}
          </h1>
          <p className="text-muted-foreground text-base text-pretty">
            {brief.targetPrompt}
          </p>
        </div>
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-6 gap-y-3 text-sm">
          {properties.map((property) => (
            <div className="contents" key={property.label}>
              <dt className="text-muted-foreground">{property.label}</dt>
              <dd className="leading-relaxed text-pretty">{property.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <PlanSection title={t("outline.title")}>
        <ol className="space-y-8">
          {brief.sections.map((section, index) => (
            <li
              className="flex gap-4"
              key={`${section.heading}:${section.goal}`}
            >
              <span className="text-muted-foreground w-5 shrink-0 pt-0.5 font-mono text-xs tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 space-y-2">
                <h3 className="text-base font-medium text-pretty">
                  {section.heading}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {section.goal}
                </p>
                {section.claims.length > 0 ? (
                  <ul className="marker:text-muted-foreground list-disc space-y-1.5 pt-1 pl-4 text-sm leading-relaxed">
                    {section.claims.map((claim) => (
                      <li className="text-pretty" key={claim}>
                        {claim}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </PlanSection>

      {brief.questionsToAnswer.length > 0 ? (
        <PlanSection title={tContentShared("faq")}>
          <ul className="divide-border divide-y text-sm">
            {brief.questionsToAnswer.map((question) => (
              <li className="py-2.5 text-pretty first:pt-0" key={question}>
                {question}
              </li>
            ))}
          </ul>
        </PlanSection>
      ) : null}

      {brief.internalLinks.length > 0 ? (
        <PlanSection title={tCommon("links")}>
          <ul className="space-y-4 text-sm">
            {brief.internalLinks.map((link) => (
              <li className="space-y-1" key={link.url}>
                <a
                  className="decoration-border hover:decoration-foreground font-medium underline underline-offset-4"
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.anchor}
                </a>
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {link.url}
                </p>
                {link.why ? (
                  <p className="text-muted-foreground text-pretty">
                    {link.why}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </PlanSection>
      ) : null}

      {brief.acceptanceChecklist.length > 0 ? (
        <PlanSection title={t("checks.title")}>
          <ul className="space-y-2.5 text-sm">
            {brief.acceptanceChecklist.map((check) => (
              <li className="flex gap-2.5" key={check}>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  icon={Tick02Icon}
                />
                <span className="leading-relaxed text-pretty">{check}</span>
              </li>
            ))}
          </ul>
        </PlanSection>
      ) : null}
    </article>
  );
}
