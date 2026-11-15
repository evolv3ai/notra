"use client";

import {
  Invoice01Icon,
  UserAdd01Icon,
  PlusSignIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PAID_OR_LEGACY_PLAN_IDS } from "@notra/ai/billing/features";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { CreditBalanceMenuItem } from "@/components/billing/credit-balance-button";
import { CreditTopupModal } from "@/components/billing/credit-topup-modal";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useSwitchOrganization } from "@/lib/hooks/use-switch-organization";
import { cn } from "@/lib/utils";
import { resolveOrganizationLogo } from "@/utils/avatar";
import { planDisplayName } from "@/utils/billing-plans";
import dynamic from "@/utils/lazy-component";
import { nameInitials } from "@/utils/name-initials";
import { canCreateAdditionalOrganizations } from "@/utils/organization-limits";

import {
  type Organization,
  useOrganizationsContext,
} from "../providers/organization-provider";

const CreateOrgModal = dynamic(() =>
  import("./create-org-modal").then((mod) => ({
    default: mod.CreateOrgModal,
  }))
);

const ORG_MENU_ITEM_CLASS = "cursor-pointer py-1.5";

function OrgAvatar({ organization }: { organization: Organization }) {
  return (
    <Avatar className="size-5 rounded-md after:rounded-md">
      <AvatarImage src={resolveOrganizationLogo(organization.logo)} />
      <AvatarFallback className="rounded-md text-[10px]">
        {nameInitials(organization.name, 1)}
      </AvatarFallback>
    </Avatar>
  );
}

function useActivePlan() {
  const { data: customer } = useBillingCustomer({
    expand: ["subscriptions.plan"],
  });
  const activeSubscription = customer?.subscriptions.find(
    (subscription) => !subscription.addOn && subscription.status === "active"
  );
  const activePlanId =
    activeSubscription?.plan?.id ?? activeSubscription?.planId;
  const hasActivePaidPlan =
    !!activePlanId && PAID_OR_LEGACY_PLAN_IDS.has(activePlanId);
  return {
    hasActivePaidPlan,
    planBadge: hasActivePaidPlan
      ? planDisplayName(activeSubscription?.plan?.name)
      : null,
  };
}

/**
 * The organization half of the top-left switcher: the active org opens a
 * submenu to switch or create orgs, followed by org-level actions. Modals are
 * rendered by `OrgMenuDialogs` outside the dropdown so they survive it closing.
 */
export function useOrgMenu() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  return {
    isCreateOpen,
    isTopupOpen,
    openCreate: () => setIsCreateOpen(true),
    openTopup: () => setIsTopupOpen(true),
    setIsCreateOpen,
    setIsTopupOpen,
  };
}

export function OrgSwitcherSubmenu({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("nav.orgSelector");
  const tCommon = useTranslations("common.actions");
  const { activeOrganization, organizations, requestOrganizations } =
    useOrganizationsContext();
  const { switchOrganization, isSwitching } = useSwitchOrganization();
  const { openSettings } = useSettingsModal();
  const { hasActivePaidPlan, planBadge } = useActivePlan();

  if (!activeOrganization) {
    return null;
  }

  function handleCreate() {
    if (!canCreateAdditionalOrganizations(hasActivePaidPlan)) {
      toast(t("subscribeToCreate"), {
        action: {
          label: tCommon("upgrade"),
          onClick: () => openSettings("billing"),
        },
      });
      return;
    }
    onCreate();
  }

  return (
    <>
      <DropdownMenuSub
        onOpenChange={(open) => {
          if (open) {
            requestOrganizations();
          }
        }}
      >
        <DropdownMenuSubTrigger
          className={cn(ORG_MENU_ITEM_CLASS, "gap-2")}
          disabled={isSwitching}
        >
          <OrgAvatar organization={activeOrganization} />
          <span
            className="min-w-0 flex-1 truncate text-sm"
            title={activeOrganization.name}
          >
            {activeOrganization.name}
          </span>
          {planBadge ? (
            <Badge
              className="bg-primary/10 text-primary shrink-0 font-semibold uppercase"
              size="sm"
            >
              {planBadge}
            </Badge>
          ) : null}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56" sideOffset={6}>
          <DropdownMenuGroup>
            {organizations.map((org) => {
              const isSelected = activeOrganization.id === org.id;
              return (
                <DropdownMenuItem
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(ORG_MENU_ITEM_CLASS, "gap-2 pl-7")}
                  disabled={isSwitching}
                  key={org.id}
                  onClick={() => {
                    if (!isSelected) {
                      switchOrganization(org);
                    }
                  }}
                >
                  {isSelected ? (
                    <HugeiconsIcon
                      className="text-muted-foreground absolute left-2 size-3.5"
                      icon={Tick02Icon}
                    />
                  ) : null}
                  <OrgAvatar organization={org} />
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={org.name}
                  >
                    {org.name}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(ORG_MENU_ITEM_CLASS, "pl-7")}
            disabled={isSwitching}
            onClick={handleCreate}
          >
            <HugeiconsIcon
              className="absolute left-2 size-3.5"
              icon={PlusSignIcon}
            />
            {t("createOrganization")}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
    </>
  );
}

export function OrgActionItems({ onOpenTopup }: { onOpenTopup: () => void }) {
  const t = useTranslations("nav.orgSelector");
  const { openSettings } = useSettingsModal();
  const { hasActivePaidPlan } = useActivePlan();

  return (
    <DropdownMenuGroup>
      <CreditBalanceMenuItem
        className={ORG_MENU_ITEM_CLASS}
        onOpenTopup={onOpenTopup}
      />
      <DropdownMenuItem
        className={ORG_MENU_ITEM_CLASS}
        onClick={() => openSettings("billing")}
      >
        <HugeiconsIcon icon={Invoice01Icon} />
        {t("billing")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className={ORG_MENU_ITEM_CLASS}
        onClick={() => openSettings("members")}
      >
        <HugeiconsIcon icon={UserAdd01Icon} />
        {t("inviteMembers")}
      </DropdownMenuItem>
      {hasActivePaidPlan ? null : (
        <DropdownMenuItem
          className={cn(
            ORG_MENU_ITEM_CLASS,
            "text-primary focus:text-primary [&_svg]:text-primary"
          )}
          onClick={() => openSettings("billing")}
        >
          <HugeiconsIcon icon={SparklesIcon} />
          {t("upgradeToGrowth")}
        </DropdownMenuItem>
      )}
    </DropdownMenuGroup>
  );
}

export function OrgMenuDialogs({
  menu,
}: {
  menu: ReturnType<typeof useOrgMenu>;
}) {
  const isClient = useIsClient();
  return (
    <>
      <Suspense fallback={null}>
        {isClient ? (
          <CreateOrgModal
            onOpenChange={menu.setIsCreateOpen}
            open={menu.isCreateOpen}
          />
        ) : null}
      </Suspense>
      <CreditTopupModal
        onOpenChange={menu.setIsTopupOpen}
        open={menu.isTopupOpen}
      />
    </>
  );
}
