import { DIALOG_CONFIRM_POPUP_SELECTOR } from "@notra/ui/constants/dialog-confirm";
import type { KeyboardEvent } from "react";

/** Confirm only an explicitly marked `button[data-dialog-confirm]`. */
export function handleDialogConfirm(event: KeyboardEvent<HTMLElement>) {
  if (
    event.defaultPrevented ||
    event.key !== "Enter" ||
    !(event.metaKey || event.ctrlKey) ||
    event.altKey ||
    event.shiftKey ||
    event.nativeEvent.isComposing ||
    event.nativeEvent.keyCode === 229
  ) {
    return;
  }

  const popup = event.currentTarget;
  if (
    !(event.target instanceof Element) ||
    event.target.closest(DIALOG_CONFIRM_POPUP_SELECTOR) !== popup ||
    popup.hasAttribute("data-nested-dialog-open")
  ) {
    return;
  }

  const buttons = Array.from(
    popup.querySelectorAll<HTMLButtonElement>("button[data-dialog-confirm]")
  ).filter(
    (button) =>
      button.closest(DIALOG_CONFIRM_POPUP_SELECTOR) === popup &&
      !button.closest('[hidden], [inert], [aria-hidden="true"]') &&
      button.checkVisibility({ checkVisibilityCSS: true })
  );
  // Never guess between multiple actions or fall through to a secondary action.
  const [button] = buttons;
  if (!button || buttons.length !== 1) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (
    !event.repeat &&
    !button.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]')
  ) {
    button.click();
  }
}
