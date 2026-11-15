import {
  ArrowUpRight01Icon,
  Download04Icon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { debounce, useQueryStates } from "nuqs";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  QR_CODE_MARKDOWN_PATH,
  QR_CODE_MAX_MARGIN,
  QR_CODE_PNG_SIZE,
  QR_CODE_SVG_PATH,
  QR_CODE_URL,
  QR_CODE_URL_DEBOUNCE_MS,
  QR_ERROR_LEVELS,
} from "@/constants/qr-code";
import { UTM_BUILDER_PATH } from "@/constants/utm-builder";
import { effectiveLevel, qrCodeIssue, qrCodeProps } from "@/lib/qr-code/build";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr-code/download";
import { logoUrlIssue } from "@/lib/qr-code/logo";
import { qrCodeParsers, serializeQrCode } from "@/schemas/qr-code";
import { serializeUtmBuilder } from "@/schemas/utm-builder";
import type { QrCodeLogo } from "@/types/qr-code";

import { QrLogoField } from "./qr-logo-field";

const labelClass =
  "font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white";
const hintClass =
  "font-sans text-[0.8125rem]/5 text-[#1E1E1E99] dark:text-white/50";
const linkClass =
  "inline-flex items-center gap-1 font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E99] underline-offset-4 hover:text-[#1E1E1E] hover:underline dark:text-white/55 dark:hover:text-white";
const colorInputClass =
  "h-10 w-full cursor-pointer rounded-xl border border-[#E4E4E4] bg-transparent p-1 dark:border-white/12";

export function QrCodeTool() {
  const [state, setState] = useQueryStates(qrCodeParsers, {
    clearOnDefault: true,
    history: "replace",
    scroll: false,
    limitUrlUpdates: debounce(QR_CODE_URL_DEBOUNCE_MS),
  });
  const [upload, setUpload] = useState<QrCodeLogo | null>(null);
  const logoError = state.logo ? logoUrlIssue(state.logo) : null;
  const linkedLogo =
    state.logo && !logoError ? { name: state.logo, src: state.logo } : null;
  const logo = upload ?? linkedLogo;
  const svgRef = useRef<SVGSVGElement>(null);

  const level = effectiveLevel(state.level, Boolean(logo));
  const issue = state.text ? qrCodeIssue(state.text, level) : null;
  const ready = Boolean(state.text) && !issue;

  const download = (format: "svg" | "png") => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    (format === "svg" ? downloadQrSvg(svg) : downloadQrPng(svg)).catch(
      (error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Could not make the file."
        )
    );
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_17rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className={labelClass} htmlFor="qr-text">
            Link or text
          </Label>
          <Textarea
            aria-invalid={issue ? true : undefined}
            autoComplete="off"
            className="min-h-20 rounded-xl border-[#E4E4E4] bg-transparent px-3.5 py-3 font-mono text-[0.9375rem]/5 shadow-none placeholder:font-sans placeholder:text-[#1E1E1E66] dark:border-white/12 dark:placeholder:text-white/40"
            id="qr-text"
            onChange={(event) => setState({ text: event.target.value })}
            placeholder="https://example.com, a Wi-Fi string or any text"
            spellCheck={false}
            value={state.text}
          />
          {issue ? (
            <p className="text-destructive font-sans text-[0.8125rem]/5">
              {issue}
            </p>
          ) : (
            <p className={hintClass}>
              Running a campaign?{" "}
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={serializeUtmBuilder(UTM_BUILDER_PATH, {
                  url: state.text || null,
                })}
              >
                Tag the link with UTM parameters
              </a>{" "}
              first so scans show up as their own source.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="qr-fg">
              Code colour
            </Label>
            <input
              className={colorInputClass}
              id="qr-fg"
              onChange={(event) =>
                setState({ fg: event.target.value.slice(1) })
              }
              type="color"
              value={`#${state.fg}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="qr-bg">
              Background
            </Label>
            <input
              className={colorInputClass}
              id="qr-bg"
              onChange={(event) =>
                setState({ bg: event.target.value.slice(1) })
              }
              type="color"
              value={`#${state.bg}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="qr-margin">
              Margin
            </Label>
            <Input
              className="h-10 rounded-xl border-[#E4E4E4] bg-transparent px-3 font-mono text-[0.875rem]/5 shadow-none dark:border-white/12"
              id="qr-margin"
              max={QR_CODE_MAX_MARGIN}
              min={0}
              onChange={(event) =>
                setState({ margin: event.target.valueAsNumber || 0 })
              }
              type="number"
              value={state.margin}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Error correction</span>
          <div className="flex flex-wrap gap-2">
            {QR_ERROR_LEVELS.map((option) => (
              <button
                aria-pressed={level === option.id}
                className="aria-pressed:border-primary aria-pressed:text-primary inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1E1E1E14] bg-white px-2.5 py-1 font-sans text-[0.8125rem]/5 font-medium text-[#1E1E1E] transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                disabled={Boolean(logo)}
                key={option.id}
                onClick={() => setState({ level: option.id })}
                type="button"
              >
                {option.label}
                <span className="font-normal text-[#1E1E1E80] dark:text-white/45">
                  {option.recovery}
                </span>
              </button>
            ))}
          </div>
          <span className={hintClass}>
            {logo
              ? "Set to High while a logo covers the middle, so the code still scans."
              : "Higher levels survive scratches and logos but make the code denser."}
          </span>
        </div>

        <QrLogoField
          logoError={logoError}
          logoUrl={state.logo}
          onLogoUrlChange={(value) => setState({ logo: value })}
          onUpload={(value) => {
            setUpload(value);
            setState({ logo: null });
          }}
          upload={upload}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#1E1E1E14] bg-[#FAFAFA] p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[#1E1E1E0D] bg-white dark:border-white/5">
          {ready ? (
            <QRCodeSVG
              {...qrCodeProps(state, QR_CODE_PNG_SIZE, logo)}
              className="size-full"
              ref={svgRef}
            />
          ) : (
            <p className="px-6 text-center font-sans text-[0.875rem]/5.5 text-[#1E1E1E99]">
              Your QR code shows up here as soon as there is something to
              encode.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!ready} onClick={() => download("svg")} size="sm">
            <HugeiconsIcon icon={Download04Icon} />
            SVG
          </Button>
          <Button
            disabled={!ready}
            onClick={() => download("png")}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon icon={Download04Icon} />
            PNG
          </Button>
        </div>
        {ready ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CopyButton
              icon={Share08Icon}
              size="sm"
              value={serializeQrCode(QR_CODE_URL, state)}
              variant="ghost"
            >
              Share
            </CopyButton>
            <a
              className={linkClass}
              href={serializeQrCode(QR_CODE_SVG_PATH, state)}
            >
              SVG link
              <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
            </a>
            <a
              className={linkClass}
              href={serializeQrCode(QR_CODE_MARKDOWN_PATH, state)}
            >
              Markdown
              <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
