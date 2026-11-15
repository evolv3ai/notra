import { Cancel01Icon, Image02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Input } from "@notra/ui/components/ui/input";
import { type ChangeEvent, useRef } from "react";
import { toast } from "sonner";

import { QR_CODE_MAX_LOGO_BYTES } from "@/constants/qr-code";
import { readSvgLogo } from "@/lib/qr-code/download";
import type { QrLogoFieldProps } from "@/types/qr-code";

const hintClass =
  "font-sans text-[0.8125rem]/5 text-[#1E1E1E99] dark:text-white/50";

export function QrLogoField({
  upload,
  logoUrl,
  logoError,
  onUpload,
  onLogoUrlChange,
}: QrLogoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
      toast.error("Pick an SVG file.");
      return;
    }
    if (file.size > QR_CODE_MAX_LOGO_BYTES) {
      toast.error("That SVG is over 500 KB. Pick a smaller one.");
      return;
    }
    onUpload({ name: file.name, src: await readSvgLogo(file) });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
        Logo
      </span>
      <input
        accept=".svg,image/svg+xml"
        aria-label="Upload SVG logo"
        className="sr-only"
        onChange={handleFile}
        ref={fileRef}
        tabIndex={-1}
        type="file"
      />
      {upload ? (
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[0.8125rem]/5 text-[#1E1E1E] dark:text-white">
            {upload.name}
          </span>
          <Button
            aria-label="Remove logo"
            onClick={() => onUpload(null)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="shrink-0"
            onClick={() => fileRef.current?.click()}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon icon={Image02Icon} />
            Upload SVG
          </Button>
          <Input
            aria-describedby="qr-logo-hint"
            aria-invalid={logoError ? true : undefined}
            aria-label="Logo link"
            autoComplete="off"
            className="h-8 rounded-lg border-[#E4E4E4] bg-transparent px-3 font-mono text-[0.8125rem]/5 shadow-none placeholder:font-sans placeholder:text-[#1E1E1E66] dark:border-white/12 dark:placeholder:text-white/40"
            inputMode="url"
            onChange={(event) => onLogoUrlChange(event.target.value)}
            placeholder="or paste an Imgur link, like https://i.imgur.com/abc.png"
            spellCheck={false}
            value={logoUrl}
          />
        </div>
      )}
      {logoError ? (
        <span className="text-destructive font-sans text-[0.8125rem]/5">
          {logoError}
        </span>
      ) : (
        <span className={hintClass} id="qr-logo-hint">
          Uploaded files stay on your device and are not part of the share link.
          Imgur links are, so agents and teammates get the same code.
        </span>
      )}
    </div>
  );
}
