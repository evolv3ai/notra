import { toast } from "sonner";

const guards = new Set<NonNullable<Window["onbeforeunload"]>>();
let signedOut = false;

export function registerBeforeUnloadGuard(
  warn: NonNullable<Window["onbeforeunload"]>
) {
  const guard: NonNullable<Window["onbeforeunload"]> = (event) => {
    if (!signedOut) {
      warn.call(window, event);
    }
  };
  guards.add(guard);
  window.addEventListener("beforeunload", guard);
  return () => {
    guards.delete(guard);
    window.removeEventListener("beforeunload", guard);
  };
}

export async function confirmSignOut(
  message: string,
  confirmLabel: string,
  cancelLabel: string
): Promise<boolean> {
  if (guards.size === 0) {
    return true;
  }
  return new Promise((resolve) => {
    toast.warning(message, {
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: { label: confirmLabel, onClick: () => resolve(true) },
      cancel: { label: cancelLabel, onClick: () => resolve(false) },
      onDismiss: () => resolve(false),
    });
  });
}

export function allowUnloadAfterSignOut() {
  signedOut = true;
}
