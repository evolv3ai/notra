"use client";

import {
  ArrowUpRight01Icon,
  GitPullRequestIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment, useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { cn } from "@/lib/utils";
import type {
  AutopilotFindingSourceBlockProps,
  AutopilotFindingSourceProps,
  AutopilotFindingSourceRowProps,
  AutopilotFindingView,
  AutopilotSourceDescriptionProps,
  AutopilotSourceTextProps,
} from "@/types/autopilot";
import {
  ideaSourceExcerpt,
  parseSourceBlocks,
  splitInlineCode,
} from "@/utils/autopilot-findings";

const EXCERPT_PREVIEW_CHARS = 480;
const DETAIL_REPOSITORY = /in (\S+)#\d+/;

/**
 * Where an idea came from and what its post would say: the merged pull
 * request or search gap behind it, the angle the writer gets, and the source
 * text it writes from.
 */
export function AutopilotFindingSource({
  finding,
}: AutopilotFindingSourceProps) {
  const { evidence } = finding;
  const excerpt = ideaSourceExcerpt(finding);
  const pullRequests = evidence.pullRequests ?? [];
  const repository = evidence.detail?.match(DETAIL_REPOSITORY)?.[1];

  if (!evidence.brief && pullRequests.length === 0 && !evidence.keyword) {
    return null;
  }

  return (
    <section aria-labelledby="finding-source" className="space-y-3">
      <h2 className="text-sm font-medium" id="finding-source">
        Where it came from
      </h2>
      <div className={TABLE_FRAME_CLASS}>
        <div className={cn(TABLE_BODY_CLASS, "divide-y")}>
          {pullRequests.map((pull) => (
            <SourceRow
              href={pull.url}
              icon={GitPullRequestIcon}
              key={pull.url}
              meta={[
                repository ? `${repository}#${pull.number}` : `#${pull.number}`,
                pull.author ? `by @${pull.author}` : null,
              ]}
              title={pull.title}
            />
          ))}
          {evidence.keyword ? (
            <SourceRow
              href={evidence.updatePage?.url}
              icon={Search01Icon}
              meta={keywordMeta(evidence)}
              title={`"${evidence.keyword}"`}
            />
          ) : null}
          {evidence.brief ? (
            <SourceBlock label="Angle">
              <p className="text-foreground">{evidence.brief.angle}</p>
            </SourceBlock>
          ) : null}
          {excerpt ? (
            <SourceDescription
              label={finding.kind === "commits" ? "Description" : "Source"}
              text={excerpt}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SourceRow({
  icon,
  title,
  meta,
  href,
}: AutopilotFindingSourceRowProps) {
  const content = (
    <>
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        icon={icon}
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {meta.filter(Boolean).join(" · ")}
        </p>
      </div>
      {href ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
          icon={ArrowUpRight01Icon}
          strokeWidth={1.5}
        />
      ) : null}
    </>
  );
  const className = "flex items-center gap-3 px-5 py-3.5";
  return href ? (
    <a
      className={cn(className, "group hover:bg-muted/40 transition-colors")}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function keywordMeta(evidence: AutopilotFindingView["evidence"]) {
  return [
    evidence.competitors?.length
      ? `Won by ${evidence.competitors.join(", ")}`
      : null,
    evidence.updatePage ? `Updates "${evidence.updatePage.title}"` : null,
  ];
}

/** The source text, faded out past a few lines until expanded. */
function SourceDescription({ label, text }: AutopilotSourceDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > EXCERPT_PREVIEW_CHARS;
  return (
    <SourceBlock label={label}>
      <div
        className={cn(
          long &&
            !expanded &&
            "max-h-56 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        )}
      >
        <SourceText text={text} />
      </div>
      {long ? (
        <button
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs transition-colors"
          onClick={() => setExpanded((open) => !open)}
          type="button"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </SourceBlock>
  );
}

/** One labeled row under the source, label left and value right. */
function SourceBlock({ label, children }: AutopilotFindingSourceBlockProps) {
  return (
    <div className="grid gap-1.5 px-5 py-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
      <p className="text-muted-foreground text-xs leading-5 sm:text-sm">
        {label}
      </p>
      <div className="min-w-0 text-pretty">{children}</div>
    </div>
  );
}

/** A pull request body as headings, paragraphs and lists. */
function SourceText({ text }: AutopilotSourceTextProps) {
  return (
    <div className="max-w-3xl space-y-3">
      {parseSourceBlocks(text).map((block) => {
        const key = `${block.type}-${block.line}`;
        if (block.type === "heading") {
          return (
            <p
              className="text-foreground pt-1 font-medium first:pt-0"
              key={key}
            >
              {block.text}
            </p>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              className="bg-foreground/5 text-foreground overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs"
              key={key}
            >
              {block.text}
            </pre>
          );
        }
        if (block.type === "list") {
          return (
            <ul
              className="text-muted-foreground marker:text-muted-foreground/60 list-disc space-y-1 pl-5"
              key={key}
            >
              {block.items.map((item) => (
                <li key={item.line}>
                  <InlineCode text={item.text} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p className="text-muted-foreground" key={key}>
            <InlineCode text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

/** Backtick spans as code chips; everything else stays plain text. */
function InlineCode({ text }: AutopilotSourceTextProps) {
  return splitInlineCode(text).map((segment) =>
    segment.code ? (
      <code
        className="bg-foreground/10 text-foreground rounded px-1 py-0.5 font-mono text-xs"
        key={segment.offset}
      >
        {segment.text}
      </code>
    ) : (
      <Fragment key={segment.offset}>{segment.text}</Fragment>
    )
  );
}
