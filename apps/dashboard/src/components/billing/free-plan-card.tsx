"use client";

import { PLANS } from "@notra/ai/billing/features";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import { findActivePlanSubscription } from "@/utils/billing-plans";

export function FreePlanCard() {
  const t = useTranslations("billing.freePlan");
  const tCommon = useTranslations("common");
  const {
    data: customer,
    updateSubscription,
    refetch,
  } = useBillingCustomer({ expand: ["subscriptions.plan"] });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const subscription = findActivePlanSubscription(customer?.subscriptions);
  if (!subscription || subscription.planId === PLANS.FREE) {
    return null;
  }

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const scheduled = subscription.canceledAt !== null;

  async function handleDowngrade() {
    if (!subscription) {
      return;
    }
    setConfirmOpen(false);
    setLoading(true);
    try {
      await updateSubscription({
        planId: subscription.planId,
        cancelAction: "cancel_end_of_cycle",
      });
      await refetch();
      toast.success(t("success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    }
    setLoading(false);
  }

  function renderStatus() {
    if (scheduled) {
      return periodEnd
        ? t("scheduled", { date: periodEnd })
        : t("scheduledNoDate");
    }
    return periodEnd ? t("periodEnd", { date: periodEnd }) : null;
  }

  return (
    <TitleCard
      action={
        scheduled ? (
          <Badge variant="outline">{t("scheduledBadge")}</Badge>
        ) : undefined
      }
      heading={t("heading")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-1">
          <p className="text-muted-foreground text-sm">{t("description")}</p>
          <p className="text-muted-foreground/70 text-sm">{renderStatus()}</p>
        </div>
        {scheduled ? null : (
          <Button
            disabled={loading}
            onClick={() => setConfirmOpen(true)}
            size="sm"
            variant="outline"
          >
            {loading ? tCommon("states.loading") : t("downgrade")}
          </Button>
        )}
      </div>
      <ResponsiveDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("confirmTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("confirmBody")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button onClick={() => setConfirmOpen(false)} variant="outline">
              {t("cancel")}
            </Button>
            <Button onClick={handleDowngrade} variant="destructive">
              {t("confirm")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </TitleCard>
  );
}
