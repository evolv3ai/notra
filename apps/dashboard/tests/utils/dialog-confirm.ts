import { mock } from "bun:test";

import type { KeyboardEvent } from "react";

export function createDialogConfirmEvent() {
  const click = mock(() => undefined);
  const button = {
    closest: mock((selector: string) =>
      selector.includes("data-slot") ? popup : null
    ),
    checkVisibility: mock(() => true),
    matches: mock(() => false),
    click,
  };
  const popup = {
    hasAttribute: mock(() => false),
    querySelectorAll: mock(() => [button]),
  };
  const target = new EventTarget();
  Object.assign(target, { closest: () => popup });
  const event = {
    key: "Enter",
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    nativeEvent: { isComposing: false, keyCode: 13 },
    target,
    currentTarget: popup,
    preventDefault: mock(() => undefined),
    stopPropagation: mock(() => undefined),
  };
  return {
    button,
    popup,
    event,
    dispatchEvent: event as unknown as KeyboardEvent<HTMLElement>,
  };
}
