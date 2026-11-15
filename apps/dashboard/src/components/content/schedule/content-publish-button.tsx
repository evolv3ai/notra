"use client";

import {
  Alert02Icon,
  Calendar03Icon,
  CalendarRemove01Icon,
  Loading03Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  SplitButton,
  SplitButtonTrigger,
} from "@notra/ui/components/ui/split-button";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ScheduleContentDialog } from "@/components/content/schedule/schedule-content-dialog";
import {
  SCHEDULE_DIALOG_MODES,
  SCHEDULE_SLOT_DATE_FORMAT,
} from "@/constants/content-calendar";
import {
  useCancelPostSchedule,
  usePostSchedule,
  usePublishScheduleNow,
} from "@/lib/hooks/use-content-calendar";
import { useLocalDateFormat } from "@/lib/hooks/use-local-date-format";
import { useSocialVideoPending } from "@/lib/hooks/use-social-video-pending";
import { cn } from "@/lib/utils";
import type {
  ContentPublishButtonProps,
  ScheduleGatedMenuItemProps,
  ScheduleStatusControlsProps,
} from "@/types/content/schedule";
import {
  getScheduleDialogMode,
  summarizePostSchedule,
} from "@/utils/content-calendar";

function GatedMenuItem({
  icon,
  label,
  hint,
  blocked,
  onClick,
}: ScheduleGatedMenuItemProps) {
  return (
    <DropdownMenuItem
      className={cn(blocked && "items-start")}
      disabled={blocked}
      onClick={onClick}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(blocked && "mt-0.5")}
        icon={icon}
      />
      <span className="flex flex-col">
        <span>{label}</span>
        {blocked ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  );
}

function ScheduleStatusControls({
  organizationId,
  contentId,
  schedule,
  hasUnsavedChanges,
  onOpen,
}: ScheduleStatusControlsProps) {
  const t = useTranslations("content.calendar.schedule");
  const formatDate = useLocalDateFormat();
  const summary = summarizePostSchedule(schedule);
  const { state, failed } = summary;
  const mode = SCHEDULE_DIALOG_MODES[getScheduleDialogMode(summary)];
  const cancel = useCancelPostSchedule(organizationId);
  const publishNow = usePublishScheduleNow(organizationId);

  let icon = Calendar03Icon;
  let label = t("trigger");
  if (state === "publishing") {
    icon = Loading03Icon;
    label = t("publishingTrigger");
  } else if (failed) {
    icon = Alert02Icon;
    label = t("failedTrigger");
  } else if (state === "scheduled" && schedule) {
    label = t("scheduledTrigger", {
      date: formatDate(
        new Date(schedule.scheduledAt),
        SCHEDULE_SLOT_DATE_FORMAT
      ),
    });
  }

  const statusButton = (
    <Button onClick={onOpen} size="sm" variant="outline">
      <HugeiconsIcon
        className={cn(
          "size-4",
          state === "publishing" && "animate-spin",
          failed && "text-destructive"
        )}
        icon={icon}
      />
      <span className="max-w-52 truncate">{label}</span>
    </Button>
  );
  if (!mode.secondaryAction) {
    return statusButton;
  }
  return (
    <SplitButton>
      {statusButton}
      <DropdownMenu>
        <SplitButtonTrigger
          disabled={cancel.isPending || publishNow.isPending}
          label={t("moreActions")}
          size="sm"
          variant="outline"
        />
        <DropdownMenuContent align="end" className="w-56">
          {mode.canPublishNow ? (
            <GatedMenuItem
              blocked={hasUnsavedChanges}
              hint={t("saveFirstHint")}
              icon={SentIcon}
              label={t("publishNow")}
              onClick={() => publishNow.mutate(contentId)}
            />
          ) : null}
          <DropdownMenuItem
            onClick={() => cancel.mutate(contentId)}
            variant="destructive"
          >
            <HugeiconsIcon aria-hidden="true" icon={CalendarRemove01Icon} />
            {t(mode.secondaryAction)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SplitButton>
  );
}

export function ContentPublishButton({
  organizationId,
  organizationSlug,
  contentId,
  contentType,
  title,
  hasUnsavedChanges,
  published,
  publishButton,
}: ContentPublishButtonProps) {
  const t = useTranslations("content.calendar.schedule");
  const [open, setOpen] = useState(false);
  const videoPending = useSocialVideoPending(organizationId, contentId);
  const { data } = usePostSchedule(organizationId, contentId);
  const schedule = data?.schedule ?? null;
  const { active, failed } = summarizePostSchedule(schedule);
  const blocked = hasUnsavedChanges || videoPending;

  let controls = publishButton;
  if (active || failed) {
    const statusControls = (
      <ScheduleStatusControls
        contentId={contentId}
        hasUnsavedChanges={blocked}
        onOpen={() => setOpen(true)}
        organizationId={organizationId}
        schedule={schedule}
      />
    );
    controls = published ? (
      <>
        {statusControls}
        {publishButton}
      </>
    ) : (
      statusControls
    );
  } else if (!published) {
    controls = (
      <SplitButton>
        {publishButton}
        <DropdownMenu>
          <SplitButtonTrigger label={t("moreActions")} size="sm" />
          <DropdownMenuContent align="end" className="w-56">
            <GatedMenuItem
              blocked={blocked}
              hint={t("saveFirstHint")}
              icon={Calendar03Icon}
              label={t("trigger")}
              onClick={() => setOpen(true)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SplitButton>
    );
  }

  return (
    <>
      {controls}
      <ScheduleContentDialog
        contentId={contentId}
        contentType={contentType}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpenChange={setOpen}
        open={open}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        schedule={schedule}
        title={title}
      />
    </>
  );
}
