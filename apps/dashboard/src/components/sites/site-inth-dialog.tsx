"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { Badge } from "@notra/ui/components/ui/badge";
import { FieldDescription } from "@notra/ui/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { SiteConfigExample } from "@/components/sites/site-config-example";
import { useSite } from "@/components/sites/site-context";
import { SiteIntegrationLogo } from "@/components/sites/site-integration-logo";
import { SiteInthManagedPanel } from "@/components/sites/site-inth-managed-panel";
import {
  C15T_DOCS_URL,
  C15T_SELF_HOSTED_BACKEND_URL,
  CONSENT_HOSTING_MODES,
  INTH_PROVIDER,
} from "@/constants/site-consent";
import { useInthConsent } from "@/lib/hooks/use-site-consent";
import { usePathname, useSearchParams } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { SiteInthDialogProps } from "@/types/components/sites";
import type { ConsentHostingMode } from "@/types/site-consent";
import { toErrorMessage } from "@/utils/error-message";
import {
  c15tConfigExample,
  inthAuthorizeHref,
  inthCallbackPath,
} from "@/utils/site-consent";

export function SiteInthDialog({
  branch,
  open,
  onOpenChange,
  isSetUp,
  oauthError,
}: SiteInthDialogProps) {
  const t = useTranslations("sites.integrationsPage.consent");
  const tPage = useTranslations("sites.integrationsPage");
  const { organizationId, siteId } = useSite();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inth = useInthConsent({ organizationId, siteId, branch });
  const { status, connected, projects, connect, disconnect, selected } = inth;
  const [pickedMode, setPickedMode] = useState<ConsentHostingMode | null>(null);
  const mode =
    pickedMode ??
    (isSetUp && status.data && !status.data.connected
      ? "selfHosted"
      : "managed");
  const inactivePanel = connected ? "hidden" : "invisible";
  const showUseProject =
    mode === "managed" && connected && Boolean(projects.data?.length);

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <SiteIntegrationLogo provider={INTH_PROVIDER} />
            <div className="min-w-0 space-y-0.5 text-left">
              <ResponsiveDialogTitle>
                {INTH_PROVIDER.name}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {t("description")}
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>
        <div className="scrollbar-floating -mx-3 min-h-0 min-w-0 overflow-y-auto px-3">
          <Tabs
            onValueChange={(value: ConsentHostingMode) => setPickedMode(value)}
            value={mode}
          >
            <TabsList aria-label={t("title")} className="w-full">
              {CONSENT_HOSTING_MODES.map((value) => (
                <TabsTrigger className="flex-1" key={value} value={value}>
                  {t(`${value}Tab`)}
                  {value === "managed" ? (
                    <Badge size="sm">{tPage("recommended")}</Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="grid pt-3">
              <div
                className={cn(
                  "flex flex-col gap-4 [grid-area:1/1]",
                  mode !== "managed" && inactivePanel
                )}
                inert={mode !== "managed"}
                role="tabpanel"
              >
                {oauthError ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t("oauthFailed")}</AlertTitle>
                    <AlertDescription>
                      <p>{t(`errors.${oauthError}`)}</p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex-1">
                  <SiteInthManagedPanel
                    authorizeHref={inthAuthorizeHref(
                      organizationId,
                      inthCallbackPath(pathname, searchParams)
                    )}
                    inth={inth}
                  />
                </div>
              </div>
              <div
                className={cn(
                  "space-y-4 [grid-area:1/1]",
                  mode !== "selfHosted" && inactivePanel
                )}
                inert={mode !== "selfHosted"}
                role="tabpanel"
              >
                <p className="text-muted-foreground text-sm">
                  {t("selfHostedDescription")}
                </p>
                <SiteConfigExample
                  value={c15tConfigExample(C15T_SELF_HOSTED_BACKEND_URL)}
                />
              </div>
            </div>
            <FieldDescription className="mt-4">
              <Link
                className="inline-flex items-center gap-1"
                href={C15T_DOCS_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                {tPage("docs", { provider: "c15t" })}
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={ArrowUpRight01Icon}
                  size={12}
                />
              </Link>
            </FieldDescription>
          </Tabs>
        </div>
        <ResponsiveDialogFooter className="shrink-0 sm:flex-wrap sm:justify-between">
          {mode === "managed" && status.data?.connected ? (
            <Button
              disabled={disconnect.isPending}
              loading={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(undefined, {
                  onError: (error) =>
                    toast.error(toErrorMessage(error, t("disconnectFailed"))),
                })
              }
              variant="destructive"
            >
              {t("disconnect")}
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex min-w-0 flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            <Button onClick={() => onOpenChange(false)} variant="outline">
              {tPage("close")}
            </Button>
            {showUseProject ? (
              <Button
                disabled={
                  !selected?.backendUrl ||
                  connect.isPending ||
                  selected.id === status.data?.project?.id
                }
                loading={connect.isPending}
                onClick={() => {
                  if (selected) {
                    inth.applyProject(selected.id);
                  }
                }}
              >
                {t("useProject")}
              </Button>
            ) : null}
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
