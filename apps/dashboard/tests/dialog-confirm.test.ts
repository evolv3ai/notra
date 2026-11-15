import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { handleDialogConfirm } from "@notra/ui/lib/dialog-confirm";

import { createDialogConfirmEvent } from "./utils/dialog-confirm";

const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");

beforeAll(() => {
  // The handler only needs Element's instanceof boundary; DOM behavior is stubbed.
  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: EventTarget,
  });
});

afterAll(() => {
  if (originalElement) {
    Object.defineProperty(globalThis, "Element", originalElement);
  } else {
    Reflect.deleteProperty(globalThis, "Element");
  }
});

describe("dialog confirm shortcut", () => {
  test.each(["metaKey", "ctrlKey"] as const)(
    "%s + Enter clicks the explicit action once",
    (modifier) => {
      const { event, button, dispatchEvent } = createDialogConfirmEvent();
      event.metaKey = false;
      event[modifier] = true;
      handleDialogConfirm(dispatchEvent);
      expect(button.click).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    { metaKey: false },
    { key: "Escape" },
    { altKey: true },
    { shiftKey: true },
    { defaultPrevented: true },
    { nativeEvent: { isComposing: true, keyCode: 13 } },
    { nativeEvent: { isComposing: false, keyCode: 229 } },
  ])("ignores non-confirm events: %j", (overrides) => {
    const { event, popup, button, dispatchEvent } = createDialogConfirmEvent();
    Object.assign(event, overrides);
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
    expect(popup.querySelectorAll).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("does not infer an action in dialogs without an explicit confirm button", () => {
    const { popup, event, dispatchEvent } = createDialogConfirmEvent();
    popup.querySelectorAll.mockReturnValue([]);
    handleDialogConfirm(dispatchEvent);
    expect(popup.querySelectorAll).toHaveBeenCalledWith(
      "button[data-dialog-confirm]"
    );
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("does not choose between multiple marked actions", () => {
    const { popup, button, dispatchEvent } = createDialogConfirmEvent();
    popup.querySelectorAll.mockReturnValue([button, button]);
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
  });

  test("blocks disabled or busy actions and native form submission", () => {
    const { button, event, dispatchEvent } = createDialogConfirmEvent();
    button.matches.mockReturnValue(true);
    handleDialogConfirm(dispatchEvent);
    expect(button.matches).toHaveBeenCalledWith(
      ':disabled, [aria-disabled="true"], [aria-busy="true"]'
    );
    expect(button.click).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("consumes held-key repeats without clicking or submitting a form", () => {
    const { button, event, dispatchEvent } = createDialogConfirmEvent();
    event.repeat = true;
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("ignores invisible actions", () => {
    const { button, dispatchEvent } = createDialogConfirmEvent();
    button.checkVisibility.mockReturnValue(false);
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
  });

  test("ignores hidden and inert subtrees", () => {
    const { button, popup, dispatchEvent } = createDialogConfirmEvent();
    button.closest.mockReturnValue(popup);
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
  });

  test("does not confirm the parent while a nested dialog is open", () => {
    const { popup, button, dispatchEvent } = createDialogConfirmEvent();
    popup.hasAttribute.mockReturnValue(true);
    handleDialogConfirm(dispatchEvent);
    expect(popup.hasAttribute).toHaveBeenCalledWith("data-nested-dialog-open");
    expect(button.click).not.toHaveBeenCalled();
  });

  test("ignores events bubbled through portals from another popup", () => {
    const { event, button, dispatchEvent } = createDialogConfirmEvent();
    Object.assign(event.target, { closest: () => null });
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
  });

  test("ignores confirm buttons belonging to another popup", () => {
    const { button, dispatchEvent } = createDialogConfirmEvent();
    button.closest.mockReturnValue(null);
    handleDialogConfirm(dispatchEvent);
    expect(button.click).not.toHaveBeenCalled();
  });
});
