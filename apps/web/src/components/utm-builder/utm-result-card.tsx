import { ArrowUpRight01Icon, Share08Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CopyButton } from "@notra/ui/components/ui/copy-button";

import { QR_CODE_PATH } from "@/constants/qr-code";
import { serializeQrCode } from "@/schemas/qr-code";
import type { UtmResultCardProps } from "@/types/utm-builder";
import { uniqueKeys } from "@/utils/unique-keys";

import { UtmIssueList } from "./utm-issue-list";

const UTM_SEGMENT_REGEX = /(utm_[a-z_]+=[^&#]*)/;
const linkClass =
  "inline-flex items-center gap-1 font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E99] underline-offset-4 hover:text-[#1E1E1E] hover:underline dark:text-white/55 dark:hover:text-white";

export function UtmResultCard({
  result,
  shareHref,
  markdownHref,
}: UtmResultCardProps) {
  const segments = result.url?.split(UTM_SEGMENT_REGEX) ?? [];
  const keys = uniqueKeys(segments);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#1E1E1E14] bg-[#FAFAFA] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      {result.url ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[0.875rem]/6 break-all text-[#1E1E1E] dark:text-white">
            {segments.map((part, index) =>
              UTM_SEGMENT_REGEX.test(part) ? (
                <span className="text-primary" key={keys[index]}>
                  {part}
                </span>
              ) : (
                part
              )
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton size="sm" value={result.url} variant="default">
              Copy link
            </CopyButton>
            <CopyButton
              icon={Share08Icon}
              size="sm"
              value={shareHref}
              variant="outline"
            >
              Share setup
            </CopyButton>
            <a
              className={linkClass}
              href={result.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Test link
              <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
            </a>
            <a
              className={linkClass}
              href={serializeQrCode(QR_CODE_PATH, { text: result.url })}
            >
              QR code
              <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
            </a>
            <a className={linkClass} href={markdownHref}>
              Markdown for agents
              <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
            </a>
          </div>
        </div>
      ) : (
        <p className="font-sans text-[0.9375rem]/6 text-[#1E1E1E99] dark:text-white/55">
          Your link shows up here as soon as it has a destination and a source.
        </p>
      )}

      {result.classification ? (
        <div className="flex flex-col gap-1 border-t border-[#1E1E1E0D] pt-3 dark:border-white/10">
          <span className="font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E99] dark:text-white/50">
            GA4 will group this as
          </span>
          <span className="font-display text-[1.25rem]/7 font-medium tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
            {result.classification.channel}
          </span>
          <span className="font-sans text-[0.875rem]/5.5 text-[#1E1E1EBF] dark:text-white/70">
            {result.classification.reason}
          </span>
        </div>
      ) : null}

      <UtmIssueList issues={result.issues} />
    </div>
  );
}
