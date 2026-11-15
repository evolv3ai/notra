import { ArrowRight01Icon, SearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@notra/ui/components/ui/breadcrumb";
import { Separator } from "@notra/ui/components/ui/separator";
import { useSidebar } from "@notra/ui/components/ui/sidebar";
import { useTranslations } from "use-intl";

import { useCommandPalette } from "@/components/command-palette/command-palette-context";
import { BrandTopbarIdentitySelector } from "@/components/dashboard/brand-topbar-identity-selector";
import { ChatTopbarTitle } from "@/components/dashboard/chat-topbar-title";
import {
  ContentTopbarCollection,
  ContentTopbarTitle,
} from "@/components/dashboard/content-topbar-title";
import { DashboardAgentButton } from "@/components/dashboard/dashboard-agent-button";
import { HeaderActionsOutlet } from "@/components/dashboard/header-actions-portal";
import { SidebarToggle } from "@/components/dashboard/sidebar-toggle";
import Link from "@/components/framework/link";
import { usePathname } from "@/lib/navigation";
import {
  isChatPathname,
  isRecordDetailPathname,
} from "@/utils/dashboard-paths";

/**
 * Topbar. Pages title themselves and the sidebar carries search and the
 * agent, so the bar only stays where it holds controls: posts, chats and
 * brand identity, plus small screens, where it holds the sidebar toggle.
 */
export function SiteHeader() {
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const hasControls = isRecordDetailPathname(pathname);

  if (!(isMobile || hasControls)) {
    return null;
  }

  return (
    <header className="@container/topbar relative flex h-12 shrink-0 items-center gap-2 border-b">
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-2 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden lg:gap-2">
          {isMobile ? <SidebarToggle className="-ml-1" /> : null}
          {isMobile && hasControls ? (
            <Separator
              className="mx-2 h-4 self-center data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              orientation="vertical"
            />
          ) : null}
          {hasControls ? <DashboardHeaderBreadcrumbs /> : null}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <HeaderActionsOutlet />
          {isMobile ? (
            <button
              aria-label={tCommon("actions.search")}
              className="text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex size-7 items-center justify-center rounded-lg"
              onClick={() => setCommandPaletteOpen(true)}
              type="button"
            >
              <HugeiconsIcon icon={SearchIcon} size={14} strokeWidth={1.8} />
            </button>
          ) : null}
          {isChatPathname(pathname) ? null : <DashboardAgentButton />}
        </div>
      </div>
    </header>
  );
}

function DashboardHeaderBreadcrumbs() {
  const pathname = usePathname();
  const [slug, section, detail] = pathname.split("/").filter(Boolean);
  const tLabels = useTranslations("common.labels");
  const tUi = useTranslations("ui");
  const isBrandIdentity = section === "brand";
  const isContentDetail = section === "content";
  const label = isBrandIdentity
    ? tLabels("brandIdentityTitle")
    : isContentDetail
      ? tLabels("content")
      : tLabels("chat");

  return (
    <Breadcrumb aria-label={tUi("breadcrumb")} className="min-w-0">
      <BreadcrumbList className="text-foreground min-w-0 flex-nowrap gap-2 text-sm font-medium">
        <BreadcrumbItem className="shrink-0 whitespace-nowrap hover:underline">
          <BreadcrumbLink
            render={
              <Link
                href={
                  isBrandIdentity
                    ? `/${slug}/brand/identity`
                    : `/${slug}/${section}`
                }
              >
                {label}
              </Link>
            }
          />
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </BreadcrumbSeparator>
        {isContentDetail && detail ? (
          <ContentTopbarCollection contentId={detail} />
        ) : null}
        <BreadcrumbItem className="min-w-0">
          {isBrandIdentity ? (
            <BrandTopbarIdentitySelector slug={slug ?? ""} />
          ) : isContentDetail && detail ? (
            <ContentTopbarTitle contentId={detail} />
          ) : detail ? (
            <ChatTopbarTitle chatId={detail} />
          ) : null}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
