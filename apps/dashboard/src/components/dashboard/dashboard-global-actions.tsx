"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTranslations } from "use-intl";

import { useFeedback } from "@/components/dashboard/feedback-context";
import { FeedbackForm } from "@/components/dashboard/feedback-popover";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { usePathname } from "@/lib/navigation";
import { scheduleDemo } from "@/utils/schedule-demo";

/**
 * Shortcuts and dialogs that outlive the topbar. The jobs sidebar's topbar
 * only renders on record pages and on small screens, so these live in the shell.
 */
export function DashboardGlobalActions() {
  const t = useTranslations("dashboard.header");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0];
  const {
    open: feedbackOpen,
    setOpen: setFeedbackOpen,
    openFeedback,
  } = useFeedback();
  const {
    isOpen: settingsOpen,
    openSettings,
    closeSettings,
  } = useSettingsModal();

  useHotkey("Mod+,", (event) => {
    event.preventDefault();
    if (!slug) {
      return;
    }

    if (settingsOpen) {
      closeSettings();
      return;
    }

    openSettings("account");
  });

  useHotkey("F", () => {
    openFeedback();
  });

  useHotkey("S", () => {
    void scheduleDemo();
  });

  return (
    <>
      <button
        aria-hidden
        className="hidden"
        data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
        data-cal-link="dominikkoch/15min"
        data-cal-namespace="15min"
        tabIndex={-1}
        type="button"
      />
      <ResponsiveDialog onOpenChange={setFeedbackOpen} open={feedbackOpen}>
        <ResponsiveDialogContent
          className="gap-0 p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>
              {tCommon("labels.sendFeedback")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("feedbackDescription")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {feedbackOpen ? (
            <FeedbackForm
              autoFocus={false}
              onSubmitted={() => setFeedbackOpen(false)}
            />
          ) : null}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
