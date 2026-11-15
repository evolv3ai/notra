"use client";

import { Add01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FEATURES } from "@notra/ai/billing/features";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { useAggregateEvents } from "autumn-js/react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { CreditTopupModal } from "@/components/billing/credit-topup-modal";
import { Button } from "@/components/button";
import { USAGE_FEATURE_SKELETON_KEYS } from "@/constants/billing";
import { useAutumnRefreshListener } from "@/lib/hooks/use-autumn-refresh-listener";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import { useUsageFeatureName } from "@/lib/hooks/use-usage-feature-name";
import type {
  FeatureData,
  UsageLimitedFeatureRowProps,
  UsageRangeOption,
  UsageSectionBodyProps,
} from "@/types/hooks/billing";
import {
  creditsValue,
  featuresFromBalances,
  meteredUsageFeatures,
  usageBreakdownPoints,
} from "@/utils/billing-usage";
import {
  formatCount,
  formatPercent,
  remainingBarColor,
  remainingPercent,
} from "@/utils/format";
import dynamic from "@/utils/lazy-component";

const UsageBreakdownChart = dynamic(
  () =>
    import("@/components/billing/usage-breakdown-chart").then(
      (mod) => mod.UsageBreakdownChart
    ),
  {
    loading: () => <Skeleton className="h-[280px] w-full rounded-lg" />,
  }
);

function RemainingBar({
  label,
  remaining,
}: {
  label: string;
  remaining: number;
}) {
  const t = useTranslations("billing.usage");
  const locale = useLocale();
  return (
    <div
      aria-label={t("remainingAria", {
        label,
        percent: formatPercent(remaining, locale),
      })}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(remaining)}
      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      role="progressbar"
    >
      <div
        className={cn(
          "duration-slower transition-width h-full w-(--remaining) rounded-full",
          remaining < 30 ? remainingBarColor(remaining) : "bg-foreground/80"
        )}
        style={{ "--remaining": `${remaining}%` } as CSSProperties}
      />
    </div>
  );
}

function UsageRow({
  name,
  value,
  info,
  action,
  remaining,
}: {
  name: string;
  value: string;
  info?: string;
  action?: ReactNode;
  remaining?: number | null;
}) {
  const t = useTranslations("billing.usage");
  return (
    <div className="space-y-2.5 px-4 py-3">
      <div className="flex min-h-6 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-0.5">
          <p className="min-w-0 truncate text-sm font-medium" title={name}>
            {name}
          </p>
          {info ? (
            <Tooltip>
              <TooltipTrigger
                aria-label={t("about", { name })}
                className="text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center"
              >
                <HugeiconsIcon
                  className="size-3.5"
                  icon={InformationCircleIcon}
                />
              </TooltipTrigger>
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm tabular-nums">{value}</p>
          {action}
        </div>
      </div>
      {remaining != null ? (
        <RemainingBar label={name} remaining={remaining} />
      ) : null}
    </div>
  );
}

function UsageSectionSkeleton() {
  return (
    <div className="space-y-6">
      <TitleCard
        contentClassName="p-0"
        headingAs="div"
        heading={<Skeleton className="h-5 w-40" />}
      >
        <div className="divide-y">
          {USAGE_FEATURE_SKELETON_KEYS.map((key) => (
            <div className="space-y-2.5 px-4 py-3" key={key}>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </TitleCard>
      <Skeleton className="h-[300px] rounded-2xl" />
    </div>
  );
}

function limitValue(feature: FeatureData, locale: string) {
  return `${feature.balance !== null ? formatCount(feature.balance, locale) : "-"} / ${formatCount(feature.included ?? 0, locale)}`;
}

function UsageMeteredFeatureRow({ feature }: UsageLimitedFeatureRowProps) {
  const locale = useLocale();
  const featureName = useUsageFeatureName()(feature);
  return (
    <UsageRow
      name={featureName}
      remaining={remainingPercent(feature.balance, feature.included)}
      value={limitValue(feature, locale)}
    />
  );
}

export function UsageSection() {
  const [range, setRange] = useState<UsageRangeOption>("30d");
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const {
    data: customer,
    isLoading: customerLoading,
    refetch,
  } = useBillingCustomer({
    expand: ["balances.feature"],
  });
  useAutumnRefreshListener(refetch);

  const hasAiAnswers = Boolean(customer?.balances?.[FEATURES.AI_ANSWERS]);
  const { list: aggregatedList, isLoading: usageLoading } = useAggregateEvents({
    featureId: FEATURES.AI_ANSWERS,
    range,
    binSize: "day",
    queryOptions: {
      enabled: hasAiAnswers,
      placeholderData: keepPreviousData,
    },
  });

  const chartData = usageBreakdownPoints(aggregatedList);

  if (customerLoading && !customer) {
    return <UsageSectionSkeleton />;
  }

  const features = featuresFromBalances(customer?.balances);
  const aiAnswersFeature = features.find(
    (feature) => feature.id === FEATURES.AI_ANSWERS
  );
  const aiCreditsFeature = features.find(
    (feature) => feature.id === FEATURES.AI_CREDITS
  );
  const pullRequestCreditsFeature = features.find(
    (feature) => feature.id === FEATURES.PULL_REQUEST_CREDITS
  );

  return (
    <>
      <UsageSectionBody
        aiAnswersFeature={aiAnswersFeature}
        aiAnswersRemaining={remainingPercent(
          aiAnswersFeature?.balance ?? null,
          aiAnswersFeature?.included ?? null
        )}
        aiCreditsFeature={aiCreditsFeature}
        chartData={chartData}
        chartLoading={usageLoading && chartData.length === 0}
        hasAiAnswers={hasAiAnswers}
        meteredFeatures={meteredUsageFeatures(features)}
        onOpenTopup={() => {
          setTopupSuccess(false);
          setTopupOpen(true);
        }}
        onRangeChange={setRange}
        pullRequestCreditsFeature={pullRequestCreditsFeature}
        range={range}
      />
      <CreditTopupModal
        onOpenChange={(open) => {
          setTopupOpen(open);
          if (!open) {
            setTopupSuccess(false);
          }
        }}
        onSuccess={() => {
          setTopupSuccess(true);
          void refetch();
        }}
        open={topupOpen}
        success={topupSuccess}
      />
    </>
  );
}

function UsageLimitsCard({
  aiAnswersFeature,
  aiAnswersRemaining,
  aiCreditsFeature,
  meteredFeatures,
  onOpenTopup,
  pullRequestCreditsFeature,
}: Omit<
  UsageSectionBodyProps,
  "chartData" | "chartLoading" | "hasAiAnswers" | "onRangeChange" | "range"
>) {
  const t = useTranslations("billing.usage");
  const tCommon = useTranslations("common");
  const tBillingShared = useTranslations("billing.shared");
  const locale = useLocale();
  const format = useFormatter();
  const resetAt = [aiAnswersFeature, ...meteredFeatures].find(
    (feature) => feature?.nextResetAt != null
  )?.nextResetAt;
  if (
    !aiAnswersFeature &&
    !aiCreditsFeature &&
    !pullRequestCreditsFeature &&
    meteredFeatures.length === 0
  ) {
    return null;
  }

  return (
    <TitleCard
      action={
        resetAt != null ? (
          <p className="text-muted-foreground text-sm">
            {t("resets", {
              date: format.dateTime(new Date(resetAt), {
                month: "short",
                day: "numeric",
              }),
            })}
          </p>
        ) : null
      }
      contentClassName="p-0"
      heading={t("thisCycle")}
      headingAs="h2"
    >
      <div className="divide-y">
        {aiAnswersFeature ? (
          <UsageRow
            name={tBillingShared("aiAnswers")}
            remaining={aiAnswersFeature.unlimited ? null : aiAnswersRemaining}
            value={
              aiAnswersFeature.unlimited
                ? t("unlimited")
                : limitValue(aiAnswersFeature, locale)
            }
          />
        ) : null}
        {pullRequestCreditsFeature ? (
          <UsageRow
            info={t("pullRequestFooter")}
            name={tBillingShared("pullRequestCredits")}
            value={creditsValue(pullRequestCreditsFeature, locale)}
          />
        ) : null}
        {aiCreditsFeature ? (
          <UsageRow
            action={
              <Button
                aria-label={tCommon("labels.topUpCredits")}
                onClick={onOpenTopup}
                size="icon-xs"
                variant="outline"
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              </Button>
            }
            info={t("creditsFooter")}
            name={t("aiCredits")}
            value={creditsValue(aiCreditsFeature, locale)}
          />
        ) : null}
        {meteredFeatures.map((feature) => (
          <UsageMeteredFeatureRow feature={feature} key={feature.id} />
        ))}
      </div>
    </TitleCard>
  );
}

function UsageSectionBody({
  chartData,
  chartLoading,
  hasAiAnswers,
  onRangeChange,
  range,
  ...limits
}: UsageSectionBodyProps) {
  return (
    <div className="space-y-6">
      <UsageLimitsCard {...limits} />
      {hasAiAnswers ? (
        <UsageBreakdownChart
          data={chartData}
          loading={chartLoading}
          onRangeChange={onRangeChange}
          range={range}
        />
      ) : null}
    </div>
  );
}
