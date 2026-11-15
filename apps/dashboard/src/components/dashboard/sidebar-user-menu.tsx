"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  Calendar03Icon,
  Logout01Icon,
  Message01Icon,
  PaintBoardIcon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@notra/ui/components/ui/kbd";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@notra/ui/components/ui/sidebar";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useFeedback } from "@/components/dashboard/feedback-context";
import { APPEARANCE_OPTIONS } from "@/constants/appearance";
import { flushTrackEvent } from "@/lib/analytics/posthog-client";
import { authClient } from "@/lib/auth/client";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { getUserAvatarUrl } from "@/utils/avatar";
import { nameInitials } from "@/utils/name-initials";
import { scheduleDemo } from "@/utils/schedule-demo";

const MENU_ITEM_CLASS = "cursor-pointer py-1.5";

function ThemeMenuItem() {
  const t = useTranslations("nav.user");
  const tCommon = useTranslations("common.labels");
  const { setTheme, theme } = useTheme();

  return (
    <div className="flex min-h-8 items-center gap-2 py-0.5 pr-1 pl-2.5 text-sm">
      <HugeiconsIcon
        className="text-muted-foreground size-4 shrink-0"
        icon={PaintBoardIcon}
      />
      <span id="sidebar-theme-label">{t("theme")}</span>
      <MenuPrimitive.RadioGroup
        aria-labelledby="sidebar-theme-label"
        className="bg-muted ml-auto flex items-center gap-0.5 rounded-md p-0.5"
        onValueChange={(value) => setTheme(String(value))}
        value={theme ?? "system"}
      >
        {APPEARANCE_OPTIONS.map((option) => (
          <MenuPrimitive.RadioItem
            aria-label={tCommon(option.value)}
            className="text-muted-foreground data-highlighted:text-foreground data-checked:bg-background data-checked:text-foreground focus-visible:ring-ring data-highlighted:ring-border flex size-6 cursor-pointer items-center justify-center rounded-[5px] outline-none data-checked:shadow-xs data-highlighted:ring-1"
            closeOnClick={false}
            key={option.value}
            value={option.value}
          >
            <HugeiconsIcon className="size-3.5" icon={option.icon} />
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  );
}

function SignOutMenuItem() {
  const tCommon = useTranslations("common.labels");
  const tUser = useTranslations("nav.user");
  const signOut = authClient.useSignOut();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await flushTrackEvent(POSTHOG_EVENTS.LOGOUT);
    try {
      await signOut();
    } catch {
      toast.error(tCommon("failedToSignOut"));
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenuItem
      className={MENU_ITEM_CLASS}
      disabled={isSigningOut}
      onClick={handleSignOut}
      variant="destructive"
    >
      <HugeiconsIcon icon={Logout01Icon} />
      {isSigningOut ? tUser("signingOut") : tCommon("logOut")}
    </DropdownMenuItem>
  );
}

/** Bottom-left menu: everything here belongs to the signed-in user, not the org. */
export function SidebarUserMenu() {
  const t = useTranslations("nav.user");
  const tOrg = useTranslations("nav.orgSelector");
  const tCommon = useTranslations("common.labels");
  const tSettings = useTranslations("settings.nav.sections");
  const { isMobile, state } = useSidebar();
  const { data: session, isPending } = authClient.useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { openFeedback } = useFeedback();
  const { openSettings } = useSettingsModal();
  const isApplePlatform = useIsApplePlatform();

  useHotkey("D", () => setTheme(resolvedTheme === "dark" ? "light" : "dark"));

  let dropdownSide: "bottom" | "right" | "top" = "top";
  if (isMobile) {
    dropdownSide = "bottom";
  } else if (state === "collapsed") {
    dropdownSide = "right";
  }

  const user = session?.user;
  if (!user) {
    return isPending ? (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton className="h-12" showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    ) : null;
  }

  const displayName = user.name || user.email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-popup-open:bg-sidebar-accent/90 data-popup-open:text-sidebar-accent-foreground data-popup-open:ring-sidebar-border/70 min-w-0 cursor-pointer group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:ring-0! data-popup-open:ring-1"
                size="lg"
                tooltip={displayName}
              >
                <Avatar className="duration-normal size-8 shrink-0 rounded-lg transition-opacity group-data-[collapsible=icon]:group-hover/menu-button:opacity-80 group-data-[collapsible=icon]:group-data-popup-open/menu-button:opacity-80 after:rounded-lg">
                  <AvatarImage
                    className="rounded-lg"
                    src={getUserAvatarUrl(user.image, user.email)}
                  />
                  <AvatarFallback className="bg-sidebar-accent rounded-lg">
                    {nameInitials(displayName, 1)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="duration-normal min-w-0 flex-1 truncate text-left text-sm font-medium transition-opacity ease-(--sidebar-ease) group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-75 group-data-[state=expanded]:delay-150 motion-reduce:transition-none motion-reduce:delay-0"
                  title={displayName}
                >
                  {displayName}
                </span>
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            align="start"
            className="w-64"
            side={dropdownSide}
            sideOffset={6}
          >
            <div className="grid gap-0.5 px-2 py-1.5">
              <span className="truncate text-sm font-medium">
                {displayName}
              </span>
              {user.name ? (
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              ) : null}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => openSettings("account")}
              >
                <HugeiconsIcon icon={UserIcon} />
                {t("myProfile")}
                <KbdGroup className="ml-auto">
                  <Kbd>{isApplePlatform ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>,</Kbd>
                </KbdGroup>
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => openSettings("appearance")}
              >
                <HugeiconsIcon icon={Settings01Icon} />
                {tSettings("appearance.label")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => openFeedback()}
              >
                <HugeiconsIcon icon={Message01Icon} />
                {tCommon("feedback")}
                <Kbd className="ml-auto">F</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => {
                  void scheduleDemo();
                }}
              >
                <HugeiconsIcon icon={Calendar03Icon} />
                {tOrg("scheduleDemo")}
                <Kbd className="ml-auto">S</Kbd>
              </DropdownMenuItem>
              <ThemeMenuItem />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <SignOutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
