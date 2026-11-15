"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GeoModelCatalogEntry } from "@notra/geo-core/types/geo";
import {
  applyGeoZdrEngineFallback,
  isGeoWebSearchEngine,
  sortKnownEngines,
} from "@notra/geo-core/utils/geo-engines";
import { geoModelsForProvider } from "@notra/geo-core/utils/geo-model-catalog";
import { isGeoOlostepEngine } from "@notra/geo-core/utils/geo-olostep";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { TRANSITION } from "@notra/ui/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ZdrConsentDialog } from "@/components/billing/zdr-consent-dialog";
import Link from "@/components/framework/link";
import { EngineIcon } from "@/components/geo/engine-icon";
import { NoWebSearchBadge } from "@/components/geo/no-web-search-badge";
import { Checkbox } from "@/components/motion/checkbox";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  ZDR_ADDON_ANCHOR,
  ZDR_CHECKOUT_SUCCESS_PARAM,
} from "@/constants/billing";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import { cn } from "@/lib/utils";
import type {
  GeoEnginePickerProps,
  GeoEngineProviderListProps,
  GeoEngineProviderRowProps,
  GeoPendingModelRemoval,
} from "@/types/geo";
import {
  findActivePlanSubscription,
  zdrAddonPlanId,
} from "@/utils/billing-plans";
import { getDatabuddyPaymentMetadata } from "@/utils/databuddy";
import { removedLegacyGeoModels } from "@/utils/geo-legacy-models";

const ROW_CLASS = "flex items-center justify-between gap-3 px-3 py-2";
const BATCH_LABEL = /\(batch\)$/i;
const CONSUMER_APP_GATEWAYS: ReadonlySet<string> = new Set([
  "olostep",
  "context",
]);
const PROVIDER_PREFERRED_ENGINES: ReadonlySet<string> = new Set([
  "anthropic/claude-haiku-5.5",
]);
const PROVIDER_COMPANION_ENGINES: ReadonlySet<string> = new Set([
  "google/ai-overview",
]);

function GeoModelRow({
  approved,
  checked,
  disabled,
  id,
  model,
  onCheckedChange,
  showZdrState,
  webSearch,
}: {
  approved: boolean;
  checked: boolean;
  disabled: boolean;
  id: string;
  model: GeoModelCatalogEntry;
  onCheckedChange: (checked: boolean) => void;
  showZdrState: boolean;
  webSearch: boolean;
}) {
  const t = useTranslations("geo.geoEnginePicker");
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      className="flex items-center justify-between gap-3 py-1.5 ps-14 pe-3"
      initial={false}
      layout={reduceMotion ? false : "position"}
      layoutId={reduceMotion ? undefined : `geo-model-${id}`}
      transition={reduceMotion ? { duration: 0 } : { layout: TRANSITION.enter }}
    >
      <Label
        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-normal"
        htmlFor={id}
      >
        <span className="min-w-0 text-xs">{model.label}</span>
        {webSearch ? null : <NoWebSearchBadge />}
        {model.hidden ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Badge className="shrink-0" size="sm" variant="outline">
                {t("legacyModel")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{t("legacyModelDescription")}</TooltipContent>
          </Tooltip>
        ) : null}
        {showZdrState && model.zdr === "none" ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {approved ? t("approvedWithoutZdr") : t("noZdrHost")}
          </span>
        ) : null}
      </Label>
      <Checkbox
        aria-label={t("toggleModel", { model: model.label })}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </motion.li>
  );
}

export function GeoEnginePicker({
  catalog,
  selected,
  onChange,
  enforceZdr,
  onEnforceZdrChange,
  nonZdrApproved,
  onNonZdrApprovedChange,
  canEnforceZdr,
  planLoading = false,
  disabled = false,
  labeled = true,
}: GeoEnginePickerProps) {
  const t = useTranslations("geo.geoEnginePicker");
  const tCommon2 = useTranslations("common");
  const id = useId();
  const { activeOrganization } = useOrganizationsContext();
  const { attach, data: customer, refetch } = useBillingCustomer();
  const [addonLoading, setAddonLoading] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const checkoutReturnHandled = useRef(false);
  const approvedNonZdrIds = new Set(nonZdrApproved);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pendingApproval, setPendingApproval] =
    useState<GeoModelCatalogEntry | null>(null);
  const [pendingDisable, setPendingDisable] =
    useState<GeoPendingModelRemoval | null>(null);

  const lastSelected = selected.length <= 1;
  const zdrActive = enforceZdr && canEnforceZdr;
  const selectedIds = new Set(selected);
  const pendingModelLabels = removedLegacyGeoModels(
    catalog.models,
    selected,
    pendingDisable?.ids ?? []
  )
    .map((model) => model.label)
    .join(", ");

  const select = (ids: readonly string[]) => {
    const eligible = ids.filter((id) =>
      catalog.models.some(
        (model) => model.id === id && (!model.hidden || selectedIds.has(id))
      )
    );
    onChange(sortKnownEngines(catalog, [...selected, ...eligible]));
  };
  const deselect = (ids: readonly string[]) => {
    const remove = new Set(ids);
    onChange(selected.filter((engine) => !remove.has(engine)));
    onNonZdrApprovedChange(
      nonZdrApproved.filter((engine) => !remove.has(engine))
    );
  };
  const requestDeselect = (ids: readonly string[]) => {
    if (removedLegacyGeoModels(catalog.models, selected, ids).length > 0) {
      setPendingDisable({ ids });
      return;
    }
    deselect(ids);
  };

  const toggleExpanded = (providerId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const toggleProvider = (
    models: readonly GeoModelCatalogEntry[],
    checked: boolean
  ) => {
    if (!checked) {
      requestDeselect(
        models.filter((model) => selectedIds.has(model.id)).map((m) => m.id)
      );
      return;
    }
    const candidates = models.filter(
      (model) => !model.hidden && !BATCH_LABEL.test(model.label)
    );
    const eligible = zdrActive
      ? candidates.filter(
          (model) => model.zdr !== "none" || approvedNonZdrIds.has(model.id)
        )
      : candidates;
    const pick =
      eligible.find((model) => PROVIDER_PREFERRED_ENGINES.has(model.id)) ??
      eligible.find((model) =>
        model.gateways.some((gateway) => CONSUMER_APP_GATEWAYS.has(gateway))
      ) ??
      eligible.find((model) => model.default) ??
      eligible[0];
    if (pick) {
      const companions = eligible
        .filter((model) => PROVIDER_COMPANION_ENGINES.has(model.id))
        .map((model) => model.id);
      select([pick.id, ...companions]);
      return;
    }
    const first = candidates[0];
    if (first) {
      setPendingApproval(first);
    }
  };

  const toggleModel = (model: GeoModelCatalogEntry, checked: boolean) => {
    if (!checked) {
      requestDeselect([model.id]);
      return;
    }
    if (model.hidden && !selectedIds.has(model.id)) {
      return;
    }
    const needsApproval =
      zdrActive && model.zdr === "none" && !approvedNonZdrIds.has(model.id);
    if (needsApproval) {
      setPendingApproval(model);
      return;
    }
    select([model.id]);
  };

  const approvePending = () => {
    if (!pendingApproval) {
      return;
    }
    onNonZdrApprovedChange(
      sortKnownEngines(catalog, [...nonZdrApproved, pendingApproval.id])
    );
    select([pendingApproval.id]);
    setPendingApproval(null);
  };

  // Enforcing ZDR turns off models without a ZDR host and, when nothing is
  // left, turns on the default ZDR models. Say which, since it changes what a
  // scan runs and costs.
  const announceZdrModelChanges = useCallback(
    (nextSelected: readonly string[]) => {
      const labelsFor = (ids: readonly string[]) =>
        ids
          .map(
            (engine) =>
              catalog.models.find((model) => model.id === engine)?.label ??
              engine
          )
          .join(", ");
      const before = new Set(selected);
      const after = new Set(nextSelected);
      const removed = selected.filter((engine) => !after.has(engine));
      const added = nextSelected.filter((engine) => !before.has(engine));
      if (removed.length === 0 && added.length === 0) {
        return;
      }
      const description = [
        removed.length > 0
          ? t("zdrModelsRemoved", { models: labelsFor(removed) })
          : null,
        added.length > 0
          ? t("zdrModelsAdded", { models: labelsFor(added) })
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      toast.info(t("zdrModelsChanged"), { description });
    },
    [catalog, selected, t]
  );

  const confirmDisable = () => {
    if (!pendingDisable) {
      return;
    }
    if (pendingDisable.enforceZdr) {
      onEnforceZdrChange(true);
      const nextSelected = applyGeoZdrEngineFallback(catalog, selected, {
        enforceZdr: true,
        nonZdrApprovedEngines: nonZdrApproved,
      });
      onChange(nextSelected);
      announceZdrModelChanges(nextSelected);
      const removedIds = new Set(pendingDisable.ids);
      onNonZdrApprovedChange(
        nonZdrApproved.filter((id) => !removedIds.has(id))
      );
    } else {
      deselect(pendingDisable.ids);
    }
    setPendingDisable(null);
  };

  const handleZdrChange = useCallback(
    (next: boolean) => {
      if (next) {
        const nextSelected = applyGeoZdrEngineFallback(catalog, selected, {
          enforceZdr: true,
          nonZdrApprovedEngines: nonZdrApproved,
        });
        const nextIds = new Set(nextSelected);
        const removedIds = selected.filter((id) => !nextIds.has(id));
        if (
          removedLegacyGeoModels(catalog.models, selected, removedIds).length >
          0
        ) {
          setPendingDisable({ ids: removedIds, enforceZdr: true });
          return;
        }
        onChange(nextSelected);
        announceZdrModelChanges(nextSelected);
      }
      onEnforceZdrChange(next);
    },
    [
      announceZdrModelChanges,
      catalog,
      nonZdrApproved,
      onChange,
      onEnforceZdrChange,
      selected,
    ]
  );

  useEffect(() => {
    if (checkoutReturnHandled.current || !canEnforceZdr) {
      return;
    }

    const returnUrl = new URL(window.location.href);
    if (returnUrl.searchParams.get(ZDR_CHECKOUT_SUCCESS_PARAM) !== "true") {
      return;
    }

    checkoutReturnHandled.current = true;
    handleZdrChange(true);
    returnUrl.searchParams.delete(ZDR_CHECKOUT_SUCCESS_PARAM);
    window.history.replaceState(null, "", returnUrl);
  }, [canEnforceZdr, handleZdrChange]);

  const handleAddZdr = async () => {
    const activeSubscription = findActivePlanSubscription(
      customer?.subscriptions
    );
    const addonPlanId = zdrAddonPlanId(activeSubscription?.planId);
    if (!addonPlanId) {
      toast.error(t("choosePlan"));
      return;
    }

    setAddonLoading(true);
    const successUrl = activeOrganization?.slug
      ? new URL(window.location.href)
      : undefined;
    successUrl?.searchParams.set(ZDR_CHECKOUT_SUCCESS_PARAM, "true");
    try {
      const result = await attach({
        planId: addonPlanId,
        metadata: getDatabuddyPaymentMetadata(),
        redirectMode: "if_required",
        successUrl: successUrl?.toString(),
      });
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }
      await refetch();
      handleZdrChange(true);
      toast.success(tCommon2("messages.zeroDataRetentionIsNow"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tCommon2("messages.couldNotAddZeroData")
      );
    }
    setAddonLoading(false);
  };

  const billingHref = activeOrganization
    ? `/${activeOrganization.slug}/settings/billing#${ZDR_ADDON_ANCHOR}`
    : null;

  return (
    <div className="space-y-3">
      {labeled ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{tCommon2("labels.models")}</p>
          <p className="text-muted-foreground text-xs">{t("description")}</p>
        </div>
      ) : null}

      <div className="border-border/80 bg-background overflow-hidden rounded-lg border">
        <GeoEngineProviderList
          catalog={catalog}
          disabled={disabled}
          expanded={expanded}
          id={id}
          lastSelected={lastSelected}
          nonZdrApproved={nonZdrApproved}
          onToggleExpanded={toggleExpanded}
          onToggleModel={toggleModel}
          onToggleProvider={toggleProvider}
          selected={selected}
          zdrActive={zdrActive}
        />

        <div className="divide-y border-t">
          <div className={`${ROW_CLASS} py-2.5`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${id}-zdr`}>{t("enforceZdr")}</Label>
                {canEnforceZdr ? null : (
                  <Badge size="sm" variant="outline">
                    {tCommon2("labels.addOn")}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {canEnforceZdr ? (
                  t("zdrEnabledHint")
                ) : (
                  <>
                    {t("zdrAddonHint")}{" "}
                    {billingHref ? (
                      <Link
                        className="text-foreground underline underline-offset-4"
                        href={billingHref}
                      >
                        {t("addInBilling")}
                      </Link>
                    ) : null}
                  </>
                )}
              </p>
            </div>
            {canEnforceZdr ? (
              <Switch
                checked={enforceZdr}
                disabled={disabled || planLoading}
                id={`${id}-zdr`}
                onCheckedChange={handleZdrChange}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Switch
                    aria-label={t("addZdr")}
                    checked={false}
                    className="cursor-pointer disabled:cursor-not-allowed"
                    disabled={disabled || planLoading || addonLoading}
                    id={`${id}-zdr`}
                    onCheckedChange={() => setConsentOpen(true)}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {planLoading ? t("checkingPlan") : t("addZdrTooltip")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <ZdrConsentDialog
        onConfirm={handleAddZdr}
        onOpenChange={setConsentOpen}
        open={consentOpen}
      />

      <ConfirmDialog
        confirmLabel={t("enableWithoutZdr")}
        description={
          pendingApproval && isGeoOlostepEngine(pendingApproval.id)
            ? t("noZdrDescriptionConsumerApp", { model: pendingApproval.label })
            : t("noZdrDescription")
        }
        onConfirm={approvePending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingApproval(null);
          }
        }}
        open={pendingApproval !== null}
        title={t("noZdrTitle", { model: pendingApproval?.label ?? "" })}
      />

      <ConfirmDialog
        confirmLabel={t("turnOff")}
        description={t("turnOffDescription", {
          model: pendingModelLabels,
        })}
        onConfirm={confirmDisable}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDisable(null);
          }
        }}
        open={pendingDisable !== null}
        title={t("turnOffTitle", { model: pendingModelLabels })}
      />
    </div>
  );
}

function GeoEngineProviderList({
  catalog,
  disabled,
  expanded,
  id,
  lastSelected,
  nonZdrApproved,
  onToggleExpanded,
  onToggleModel,
  onToggleProvider,
  selected,
  zdrActive,
}: GeoEngineProviderListProps) {
  const selectedIds = new Set(selected);
  const approvedNonZdrIds = new Set(nonZdrApproved);
  // Providers whose models are all legacy (no web search, superseded) would
  // render as empty rows.
  const providers = catalog.providers.filter(
    (provider) =>
      geoModelsForProvider(catalog, provider.id, selectedIds).length > 0
  );

  return (
    <ul>
      {providers.map((provider) => (
        <GeoEngineProviderRow
          approvedNonZdrIds={approvedNonZdrIds}
          catalog={catalog}
          disabled={disabled}
          expanded={expanded.has(provider.id)}
          id={id}
          key={provider.id}
          lastSelected={lastSelected}
          onToggleExpanded={onToggleExpanded}
          onToggleModel={onToggleModel}
          onToggleProvider={onToggleProvider}
          provider={provider}
          selectedCount={selected.length}
          selectedIds={selectedIds}
          zdrActive={zdrActive}
        />
      ))}
    </ul>
  );
}

function isGeoBatchModel(model: GeoModelCatalogEntry) {
  return BATCH_LABEL.test(model.label);
}

function GeoEngineProviderRow({
  approvedNonZdrIds,
  catalog,
  disabled,
  expanded,
  id,
  lastSelected,
  onToggleExpanded,
  onToggleModel,
  onToggleProvider,
  provider,
  selectedCount,
  selectedIds,
  zdrActive,
}: GeoEngineProviderRowProps) {
  const t = useTranslations("geo.geoEnginePicker");
  const models = geoModelsForProvider(catalog, provider.id, selectedIds);
  const selectedModels = models.filter((model) => selectedIds.has(model.id));
  const unselected = models.filter((model) => !selectedIds.has(model.id));
  // Batch variants are the same model on a slower queue; list them after the
  // regular releases so the newest models stay on top.
  const orderedModels = [
    ...selectedModels,
    ...unselected.filter((model) => !isGeoBatchModel(model)),
    ...unselected.filter(isGeoBatchModel),
  ];
  const enabled = selectedModels.length > 0;
  const providerLocked = enabled && selectedModels.length === selectedCount;

  return (
    <li className="border-border/60 border-b last:border-b-0">
      <div
        className={cn(
          "flex items-center gap-3 py-2.5 ps-4 pe-3 transition-colors",
          expanded ? "bg-muted/40" : "bg-background hover:bg-muted/40"
        )}
      >
        <button
          aria-expanded={expanded}
          className="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
          disabled={disabled}
          onClick={() => onToggleExpanded(provider.id)}
          type="button"
        >
          <span
            className={cn(
              "border-border/70 bg-background flex size-7 shrink-0 items-center justify-center rounded-md border transition",
              !enabled && "opacity-60 grayscale"
            )}
          >
            <EngineIcon
              className="size-3.5 overflow-visible"
              engine={models[0]?.id ?? provider.id}
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {provider.label}
              </span>
              <HugeiconsIcon
                className={cn(
                  "text-muted-foreground duration-normal size-3.5 shrink-0 transition-transform",
                  expanded && "rotate-180"
                )}
                icon={ArrowDown01Icon}
              />
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {enabled
                ? selectedModels.map((model) => model.label).join(", ")
                : t("providerOff")}
            </span>
          </span>
        </button>
        <Switch
          aria-label={t("toggleProvider", { provider: provider.label })}
          checked={enabled}
          disabled={disabled || providerLocked}
          id={`${id}-${provider.id}`}
          onCheckedChange={(next) => onToggleProvider(models, next)}
        />
      </div>
      <div
        className={cn(
          "duration-normal ease-emphasized grid transition-[grid-template-rows] motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div
          className="bg-muted/40 min-h-0 overflow-hidden"
          inert={expanded ? undefined : true}
        >
          <ul className="pb-2">
            {orderedModels.map((model) => {
              const checked = selectedIds.has(model.id);
              return (
                <GeoModelRow
                  approved={approvedNonZdrIds.has(model.id)}
                  checked={checked}
                  disabled={disabled || (checked && lastSelected)}
                  id={`${id}-${model.id}`}
                  key={model.id}
                  model={model}
                  onCheckedChange={(next) => onToggleModel(model, next)}
                  showZdrState={zdrActive}
                  webSearch={isGeoWebSearchEngine(catalog, model.id)}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}
