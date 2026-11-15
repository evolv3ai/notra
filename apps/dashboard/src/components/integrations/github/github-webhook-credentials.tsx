"use client";

import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Label } from "@notra/ui/components/ui/label";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubWebhookCredentialsProps } from "@/types/integrations/github";
import { toastCopyError } from "@/utils/copy-to-clipboard";

export function GitHubWebhookCredentials({
  webhook,
}: GitHubWebhookCredentialsProps) {
  const t = useTranslations("integrations.github.webhookSettings");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tCommon = useTranslations("common");
  const urlId = useId();
  const secretId = useId();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={urlId}>{tIntegrationsShared("payloadUrl")}</Label>
        <InputGroup>
          <InputGroupInput
            id={urlId}
            name="webhookUrl"
            type="url"
            autoComplete="off"
            spellCheck={false}
            readOnly
            value={webhook.webhookUrl}
            title={webhook.webhookUrl}
          />
          <InputGroupAddon align="inline-end">
            <CopyButton
              value={webhook.webhookUrl}
              size="icon-xs"
              aria-label={tCommon("labels.copyLabel", {
                label: tIntegrationsShared("payloadUrl"),
              })}
              copiedAriaLabel={tCommon("labels.labelCopied", {
                label: tIntegrationsShared("payloadUrl"),
              })}
              onCopy={() => toast.success(t("urlCopied"))}
              onCopyError={toastCopyError}
            />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={secretId}>{tIntegrationsShared("secret")}</Label>
        <InputGroup>
          <InputGroupInput
            id={secretId}
            name="webhookSecret"
            autoComplete="off"
            spellCheck={false}
            readOnly
            type={revealed ? "text" : "password"}
            value={webhook.webhookSecret}
          />
          <InputGroupAddon align="inline-end">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-pressed={revealed}
              aria-controls={secretId}
              aria-label={revealed ? t("hideSecret") : t("showSecret")}
              onClick={() => setRevealed((current) => !current)}
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={revealed ? ViewOffSlashIcon : ViewIcon}
              />
            </Button>
            <CopyButton
              value={webhook.webhookSecret}
              size="icon-xs"
              aria-label={tCommon("labels.copyLabel", {
                label: tIntegrationsShared("secret"),
              })}
              copiedAriaLabel={tCommon("labels.labelCopied", {
                label: tIntegrationsShared("secret"),
              })}
              onCopy={() => toast.success(t("secretCopied"))}
              onCopyError={toastCopyError}
            />
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
