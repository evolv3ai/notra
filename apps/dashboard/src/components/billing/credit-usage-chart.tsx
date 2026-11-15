"use client";

import { FEATURES } from "@notra/ai/billing/features";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@notra/ui/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { USAGE_RANGE_LABEL_KEYS } from "@/constants/billing";
import { CREDIT_USAGE_CHART_COLOR } from "@/constants/billing-credits";
import {
  CREDIT_RANGES,
  type CreditUsageChartProps,
} from "@/types/billing/credits";
import { formatDollars, isCreditRange } from "@/utils/format";

export function CreditUsageChart({
  data,
  range,
  onRangeChange,
}: CreditUsageChartProps) {
  const t = useTranslations("billing.creditUsage");
  const tCommon = useTranslations("common");
  const tLabels = useTranslations("common.labels");
  const tUsageBreakdown = useTranslations("billing.usageBreakdown");
  const locale = useLocale();
  const format = useFormatter();
  const chartConfig = {
    ai_credits: {
      label: t("creditsUsed"),
      color: CREDIT_USAGE_CHART_COLOR,
    },
  } satisfies ChartConfig;
  const formatShortDate = (timestamp: number) =>
    format.dateTime(new Date(timestamp), {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const chartData =
    data?.map((row) => {
      const value = row.values?.[FEATURES.AI_CREDITS];
      return {
        date: row.period,
        ai_credits: typeof value === "number" ? value : 0,
      };
    }) ?? [];

  const rangeItems = CREDIT_RANGES.map((value) => ({
    value,
    label: tLabels(USAGE_RANGE_LABEL_KEYS[value]),
  }));

  return (
    <TitleCard
      action={
        <Select
          items={rangeItems}
          onValueChange={(value) => {
            if (value && isCreditRange(value, CREDIT_RANGES)) {
              onRangeChange(value);
            }
          }}
          value={range}
        >
          <SelectTrigger
            aria-label={tUsageBreakdown("rangeLabel")}
            variant="ghost"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      className="min-w-0"
      heading={tCommon("labels.usage")}
      headingAs="h2"
    >
      {chartData.length > 0 ? (
        <ChartContainer
          className="aspect-auto h-[240px] w-full"
          config={chartConfig}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              className="stroke-border/20"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              className="text-muted-foreground/60 text-xs"
              dataKey="date"
              minTickGap={32}
              tickFormatter={(value: number) => formatShortDate(value)}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              className="text-muted-foreground/60 text-xs"
              tickFormatter={(value: number) => formatDollars(value, locale)}
              tickLine={false}
              tickMargin={8}
              width={48}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatDollars(Number(value), locale)}
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.date ? formatShortDate(item.date) : "";
                  }}
                />
              }
              cursor={false}
            />
            <Bar
              dataKey="ai_credits"
              fill="var(--color-ai_credits)"
              opacity={0.8}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="text-muted-foreground flex h-[240px] items-center justify-center text-sm">
          {t("empty")}
        </div>
      )}
    </TitleCard>
  );
}
