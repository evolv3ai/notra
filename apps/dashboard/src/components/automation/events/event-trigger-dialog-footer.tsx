import {
  Add01Icon,
  AlertCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { EditorFooter } from "@/components/automation/editor/editor-parts";
import { Button } from "@/components/button";
import type { EventTriggerDialogFooterProps } from "@/types/automation/event-trigger";

export function EventTriggerDialogFooter({
  errorMessage,
  isEditMode,
  isPending,
  onCancel,
}: EventTriggerDialogFooterProps) {
  const t = useTranslations("automation.events.dialog");
  const tCommon = useTranslations("common.actions");
  return (
    <EditorFooter
      status={
        errorMessage ? (
          <span className="text-destructive flex items-center gap-1.5 font-medium">
            <HugeiconsIcon className="size-3.5" icon={AlertCircleIcon} />
            {errorMessage}
          </span>
        ) : null
      }
    >
      <Button
        disabled={isPending}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        {tCommon("cancel")}
      </Button>
      <Button loading={isPending} type="submit">
        <HugeiconsIcon
          className="size-4"
          icon={isEditMode ? Tick02Icon : Add01Icon}
        />
        {isEditMode ? tCommon("saveChanges") : t("add")}
      </Button>
    </EditorFooter>
  );
}
