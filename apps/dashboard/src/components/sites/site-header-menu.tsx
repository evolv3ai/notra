"use client";

import {
  Copy01Icon,
  GitBranchIcon,
  GithubIcon,
  LinkSquare02Icon,
  MoreHorizontalIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Switch } from "@notra/ui/components/ui/switch";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { SITES_NAV_LINK } from "@/constants/sites";
import { useSiteBranchVisibility } from "@/lib/hooks/use-site-branch-visibility";
import { useRouter } from "@/lib/navigation";
import type { SiteHeaderMenuProps } from "@/types/components/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { githubBranchUrl } from "@/utils/site-links";

/** Site links plus the per-user Branches toggle. */
export function SiteHeaderMenu({
  branch,
  branchesRequired,
}: SiteHeaderMenuProps) {
  const t = useTranslations("sites.list.actions");
  const tBranches = useTranslations("sites.branches");
  const tCommon = useTranslations("common");
  const tSwitcher = useTranslations("sites.switcher");
  const router = useRouter();
  const { organizationSlug, detail } = useSite();
  const { site } = detail;
  const visibility = useSiteBranchVisibility();
  const repositoryUrl = githubBranchUrl(site.repository, branch);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tBranches("moreOptions")}
        render={<Button size="icon-sm" variant="ghost" />}
      >
        <HugeiconsIcon
          className="size-4"
          icon={MoreHorizontalIcon}
          strokeWidth={1.5}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          render={
            <a
              aria-label={t("visitSite")}
              href={site.liveUrl}
              rel="noopener noreferrer"
              target="_blank"
            />
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={LinkSquare02Icon}
            strokeWidth={1.5}
          />
          {t("visitSite")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            copyTextToClipboard(site.liveUrl, tCommon("toasts.copied"))
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Copy01Icon}
            strokeWidth={1.5}
          />
          {t("copyLink")}
        </DropdownMenuItem>
        {repositoryUrl ? (
          <DropdownMenuItem
            render={
              <a
                aria-label={t("viewOnGitHub")}
                href={repositoryUrl}
                rel="noopener noreferrer"
                target="_blank"
              />
            }
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={GithubIcon}
              strokeWidth={1.5}
            />
            {t("viewOnGitHub")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            router.push(`/${organizationSlug}${SITES_NAV_LINK}/new`)
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={PlusSignIcon}
            strokeWidth={1.5}
          />
          {tSwitcher("newSite")}
        </DropdownMenuItem>
        {branchesRequired ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              aria-checked={visibility.show}
              closeOnClick={false}
              onClick={() => visibility.setShow(!visibility.show)}
              role="menuitemcheckbox"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={GitBranchIcon}
                strokeWidth={1.5}
              />
              {tBranches("branches")}
              <Switch
                aria-hidden="true"
                checked={visibility.show}
                className="pointer-events-none ms-auto"
                nativeButton={false}
                render={<span />}
                size="sm"
                tabIndex={-1}
              />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
