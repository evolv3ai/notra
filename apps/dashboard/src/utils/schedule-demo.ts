import { toast } from "sonner";

import { commonToastMessage } from "@/utils/toast-message";

const CAL_NAMESPACE = "15min";
const CAL_TRIGGER_SELECTOR = `[data-cal-namespace="${CAL_NAMESPACE}"]`;

let calEmbedPromise: Promise<void> | null = null;

async function loadCalEmbed(): Promise<void> {
  const { getCalApi } = await import("@calcom/embed-react");
  const cal = await getCalApi({ namespace: CAL_NAMESPACE });
  cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
}

export async function scheduleDemo(): Promise<void> {
  try {
    calEmbedPromise ??= loadCalEmbed();
    await calEmbedPromise;
  } catch {
    calEmbedPromise = null;
    toast.error(commonToastMessage("bookingOpenFailed"));
    return;
  }

  document.querySelector<HTMLButtonElement>(CAL_TRIGGER_SELECTOR)?.click();
}
