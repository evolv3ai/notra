"use client";

import { SITE_HEX_COLOR } from "@notra/sites-core/constants/site-config";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useTranslations } from "use-intl";

import type { SiteColorInputProps } from "@/types/site-design";
import { toColorInputValue } from "@/utils/brand-guideline-display";

export function SiteColorInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  fallback,
}: SiteColorInputProps) {
  const t = useTranslations("sites.design");
  const shown = value || fallback || "";
  const invalid = value !== "" && !SITE_HEX_COLOR.test(value);
  return (
    <InputGroup className="w-full">
      <InputGroupAddon>
        <label
          className="ring-foreground/15 relative block size-4.5 cursor-pointer overflow-hidden rounded-[5px] ring-1"
          style={{ background: SITE_HEX_COLOR.test(shown) ? shown : undefined }}
        >
          <span className="sr-only">{t("pickColor", { name: label })}</span>
          <input
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            type="color"
            value={toColorInputValue(shown)}
          />
        </label>
      </InputGroupAddon>
      <InputGroupInput
        aria-invalid={invalid || undefined}
        aria-label={label}
        autoComplete="off"
        className="font-mono text-xs placeholder:font-sans placeholder:text-sm"
        id={id}
        maxLength={7}
        onChange={(event) => {
          const next = event.target.value.trim();
          onChange(next && !next.startsWith("#") ? `#${next}` : next);
        }}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
    </InputGroup>
  );
}
