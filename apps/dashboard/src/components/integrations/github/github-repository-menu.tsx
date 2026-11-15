import {
  CheckListIcon,
  Delete02Icon,
  Edit02Icon,
  Github01Icon,
  Key01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Settings01Icon,
  Wrench01Icon,
  WebhookIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubRepositoryMenuProps } from "@/types/integrations/github";

export function GitHubRepositoryMenu({
  integration,
  isPending,
  isEnabled,
  onToggle,
  onDialog,
  onManageRepositories,
  isMigrating,
  onMigrate,
  webhook,
}: GitHubRepositoryMenuProps) {
  const t = useTranslations("integrations.github.repositoryMenu");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const showWebhookMaintenance =
    !integration.managedByGitHubApp && webhook?.hasWebhook === true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("ariaLabel", { name: integration.displayName })}
            disabled={isPending}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <HugeiconsIcon icon={Settings01Icon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {integration.managedByGitHubApp ? (
          <DropdownMenuItem onClick={onManageRepositories}>
            <HugeiconsIcon className="size-4" icon={CheckListIcon} />
            {t("manageSelection")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onDialog("edit")}>
              <HugeiconsIcon className="size-4" icon={Edit02Icon} />
              {t("editRepository")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDialog("token")}>
              <HugeiconsIcon className="size-4" icon={Key01Icon} />
              {t("updateToken")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isMigrating} onClick={onMigrate}>
              <HugeiconsIcon className="size-4" icon={Github01Icon} />
              {isMigrating ? t("switching") : t("switchToApp")}
            </DropdownMenuItem>
            {webhook ? (
              <DropdownMenuItem
                disabled={webhook.busy}
                onClick={() => webhook.open("setup")}
              >
                <HugeiconsIcon className="size-4" icon={WebhookIcon} />
                {t("webhookSetup")}
              </DropdownMenuItem>
            ) : null}
          </>
        )}
        <DropdownMenuItem onClick={onToggle}>
          <HugeiconsIcon
            className="size-4"
            icon={isEnabled ? PauseIcon : PlayIcon}
          />
          {isEnabled ? t("pause") : t("enable")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {showWebhookMaintenance && webhook ? (
          <>
            <DropdownMenuItem
              disabled={webhook.busy || !isEnabled}
              onClick={() => webhook.open("repair")}
            >
              <HugeiconsIcon className="size-4" icon={Wrench01Icon} />
              {t("repairWebhook")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={webhook.busy}
              onClick={() => webhook.open("rotate")}
            >
              <HugeiconsIcon className="size-4" icon={RefreshIcon} />
              {tIntegrationsShared("regenerateSecret")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onClick={() => onDialog("delete")}
          variant="destructive"
        >
          <HugeiconsIcon className="size-4" icon={Delete02Icon} />
          {t("remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
