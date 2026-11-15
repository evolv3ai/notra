"use client";

import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { highlight } from "sugar-high";
import { useTranslations } from "use-intl";

import type { SiteConfigExampleProps } from "@/types/components/sites";
import { toastCopyError } from "@/utils/copy-to-clipboard";

export function SiteConfigExample({ value }: SiteConfigExampleProps) {
  const t = useTranslations("sites.integrationsPage");
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("configExample")}</p>
        <CopyButton
          copiedLabel={tCommon("actions.copied")}
          onCopyError={toastCopyError}
          size="sm"
          value={value}
          variant="outline"
        >
          {tCommon("actions.copy")}
        </CopyButton>
      </div>
      <pre
        className="bg-muted/40 border-border/60 scrollbar-floating m-0 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high escapes the source before tokenizing
        dangerouslySetInnerHTML={{ __html: highlight(value) }}
      />
    </div>
  );
}
