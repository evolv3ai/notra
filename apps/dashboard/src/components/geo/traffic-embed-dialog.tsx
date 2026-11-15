"use client";

import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import { AutopilotTagInput } from "@/components/autopilot/autopilot-tag-input";
import { Button } from "@/components/button";
import { CodeSnippet, CopyPromptButton } from "@/components/geo/code-snippet";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import {
  TRAFFIC_EMBED_DEFAULT_HEIGHT,
  TRAFFIC_EMBED_DEFAULT_RANGE,
  TRAFFIC_EMBED_RANGES,
  TRAFFIC_EMBED_RESIZE_MESSAGE,
  TRAFFIC_EMBED_SANDBOX,
} from "@/constants/traffic-embed";
import { useGeoTrafficHostQuery } from "@/lib/hooks/use-geo-traffic-host";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  TrafficEmbedPart,
  TrafficEmbedRange,
  TrafficEmbedSummary,
  TrafficEmbedTheme,
} from "@/types/traffic-embed";
import { toErrorMessage } from "@/utils/error-message";
import {
  normalizeTrafficEmbedOrigin,
  trafficEmbedSnippet,
  trafficEmbedUrl,
} from "@/utils/traffic-embed";
import { trafficEmbedName } from "@/utils/traffic-embed-name";
import { trafficEmbedAgentPrompt } from "@/utils/traffic-embed-prompt";

type EmbedLayout = "full" | "chart" | "metrics";

const LAYOUT_PARTS: Record<EmbedLayout, TrafficEmbedPart[]> = {
  full: ["metrics", "chart"],
  chart: ["chart"],
  metrics: ["metrics"],
};

// Origins are https unless typed otherwise, so the chips leave that out.
function originLabel(origin: string): string {
  return origin.replace(/^https:\/\//, "");
}

function parseOrigin(value: string): string | null {
  const result = normalizeTrafficEmbedOrigin(value);
  return result.ok ? result.origin : null;
}

function parseOriginLabel(value: string): string | null {
  const origin = parseOrigin(value);
  return origin ? originLabel(origin) : null;
}

function OriginsField({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("domainsLabel")}</FieldLabel>
      <AutopilotTagInput
        disabled={disabled}
        id={id}
        label={t("domainsLabel")}
        onChange={(next) =>
          onChange(next.flatMap((label) => parseOrigin(label) ?? []))
        }
        parse={parseOriginLabel}
        placeholder="example.com"
        values={values.map(originLabel)}
      />
      <FieldDescription>{t("domainsHint")}</FieldDescription>
    </Field>
  );
}

/** The preview does what embed.js does on customer pages: fit the content. */
function useEmbedPreviewHeight() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(TRAFFIC_EMBED_DEFAULT_HEIGHT);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; height?: unknown } | null;
      if (
        event.source === ref.current?.contentWindow &&
        event.origin === window.location.origin &&
        data?.type === TRAFFIC_EMBED_RESIZE_MESSAGE &&
        typeof data.height === "number"
      ) {
        setHeight(Math.ceil(data.height));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return { ref, height };
}

function EmbedDetails({
  organizationId,
  embed,
  onRevoked,
}: {
  organizationId: string;
  embed: TrafficEmbedSummary;
  onRevoked: () => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [origins, setOrigins] = useState(embed.allowedOrigins);
  // The last list the server confirmed, which a failed save restores.
  const [savedOrigins, setSavedOrigins] = useState(embed.allowedOrigins);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [range, setRange] = useState<TrafficEmbedRange>(
    TRAFFIC_EMBED_DEFAULT_RANGE
  );
  const [theme, setTheme] = useState<TrafficEmbedTheme>("auto");
  const [layout, setLayout] = useState<EmbedLayout>("full");
  const { ref: previewRef, height: previewHeight } = useEmbedPreviewHeight();
  const origin = useIsClient() ? window.location.origin : "";
  const src = origin
    ? trafficEmbedUrl(origin, embed.id, {
        range,
        theme,
        parts: LAYOUT_PARTS[layout],
        locale,
      })
    : "";
  const snippet = src ? trafficEmbedSnippet(origin, src, t("frameTitle")) : "";
  const prompt = snippet
    ? trafficEmbedAgentPrompt(origin, snippet, origins)
    : "";

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.trafficEmbeds.list.key(),
    });

  // Each added or removed domain saves right away. The shared scope runs the
  // saves one after another, so an older list can't land after a newer one.
  const save = useMutation({
    scope: { id: `traffic-embed-origins:${embed.id}` },
    mutationFn: (allowedOrigins: string[]) =>
      dashboardOrpc.trafficEmbeds.update.call({
        organizationId,
        embedId: embed.id,
        name: embed.name,
        allowedOrigins,
      }),
    onSuccess: async ({ embed: updated }) => {
      setSavedOrigins(updated.allowedOrigins);
      toast.success(t("saved"));
      await invalidate();
    },
    onError: (error) => {
      setOrigins(savedOrigins);
      toast.error(toErrorMessage(error, t("saveFailed")));
    },
  });

  const revoke = useMutation({
    mutationFn: () =>
      dashboardOrpc.trafficEmbeds.revoke.call({
        organizationId,
        embedId: embed.id,
      }),
    onSuccess: async () => {
      setConfirmRevoke(false);
      toast.success(t("revoked"));
      onRevoked();
      await invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, t("revokeFailed"))),
  });

  const rangeItems = TRAFFIC_EMBED_RANGES.map((value) => ({
    value,
    label: t(`ranges.${value}`),
  }));
  const themeItems = (["auto", "light", "dark"] as const).map((value) => ({
    value,
    label: t(`themes.${value}`),
  }));
  const layoutItems = (["full", "chart", "metrics"] as const).map((value) => ({
    value,
    label: t(`layouts.${value}`),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <OriginsField
        onChange={(next) => {
          if (next.length === 0) {
            toast.error(t("domainsRequired"));
            return;
          }
          setOrigins(next);
          save.mutate(next);
        }}
        values={origins}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>{t("rangeLabel")}</FieldLabel>
          <Select
            items={rangeItems}
            onValueChange={(next) => setRange(next as TrafficEmbedRange)}
            value={range}
          >
            <SelectTrigger aria-label={t("rangeLabel")}>
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
        </Field>
        <Field>
          <FieldLabel>{t("themeLabel")}</FieldLabel>
          <Select
            items={themeItems}
            onValueChange={(next) => setTheme(next as TrafficEmbedTheme)}
            value={theme}
          >
            <SelectTrigger aria-label={t("themeLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("layoutLabel")}</FieldLabel>
          <Select
            items={layoutItems}
            onValueChange={(next) => setLayout(next as EmbedLayout)}
            value={layout}
          >
            <SelectTrigger aria-label={t("layoutLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layoutItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {src ? (
        <iframe
          className="w-full"
          height={previewHeight}
          loading="lazy"
          ref={previewRef}
          sandbox={TRAFFIC_EMBED_SANDBOX}
          src={src}
          title={t("previewTitle")}
        />
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("snippetLabel")}</h3>
        <CodeSnippet
          code={snippet}
          filename="HTML"
          headerEnd={<CopyPromptButton disabled={!prompt} prompt={prompt} />}
        />
      </section>
      <Button
        className="self-start"
        onClick={() => setConfirmRevoke(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("revoke")}
      </Button>
      <ConfirmDialog
        confirmLabel={t("revoke")}
        description={t("revokeDescription")}
        onConfirm={() => revoke.mutate()}
        onOpenChange={setConfirmRevoke}
        open={confirmRevoke}
        pending={revoke.isPending}
        title={t("revokeTitle")}
        variant="destructive"
      />
    </div>
  );
}

function CreateEmbedForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: (embed: TrafficEmbedSummary) => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const [host] = useGeoTrafficHostQuery();
  const [origins, setOrigins] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      dashboardOrpc.trafficEmbeds.create.call({
        organizationId,
        ...(projectId ? { projectId } : {}),
        ...(host ? { host } : {}),
        name: trafficEmbedName(origins),
        allowedOrigins: origins,
      }),
    onSuccess: async ({ embed }) => {
      toast.success(t("created"));
      onCreated(embed);
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.trafficEmbeds.list.key(),
      });
    },
    onError: (error) => toast.error(toErrorMessage(error, t("createFailed"))),
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (origins.length > 0 && !create.isPending) {
          create.mutate();
        }
      }}
    >
      <OriginsField
        disabled={create.isPending}
        onChange={setOrigins}
        values={origins}
      />
      <p className="text-muted-foreground text-sm">
        {host ? t("scopeHost", { host }) : t("scopeAll")}
      </p>
      <Button
        className="self-end"
        disabled={origins.length === 0}
        loading={create.isPending}
        type="submit"
      >
        {t("create")}
      </Button>
    </form>
  );
}

export function TrafficEmbedDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const { projectId } = useGeoProjectScope();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isPending } = useQuery({
    ...dashboardOrpc.trafficEmbeds.list.queryOptions({
      input: { organizationId, ...(projectId ? { projectId } : {}) },
    }),
    enabled: open && Boolean(organizationId),
  });
  const embeds = data?.embeds ?? [];
  const selected =
    embeds.find((embed) => embed.id === selectedId) ?? embeds[0] ?? null;
  const showCreate = !isPending && (creating || selected === null);
  const embedItems = embeds.map((embed) => ({
    value: embed.id,
    label: embed.name,
  }));

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="sm:max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {embeds.length > 0 ? (
          <div className="flex items-center gap-2">
            {creating ? null : (
              <Select
                items={embedItems}
                onValueChange={(next) => setSelectedId(next as string)}
                value={selected?.id ?? null}
              >
                <SelectTrigger
                  aria-label={t("embedLabel")}
                  className="min-w-0 flex-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {embedItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className={creating ? "ml-auto" : undefined}
              onClick={() => setCreating((current) => !current)}
              size="sm"
              type="button"
              variant="outline"
            >
              {creating ? t("cancelNew") : t("new")}
            </Button>
          </div>
        ) : null}
        {showCreate ? (
          <CreateEmbedForm
            onCreated={(embed) => {
              setSelectedId(embed.id);
              setCreating(false);
            }}
            organizationId={organizationId}
          />
        ) : null}
        {!showCreate && selected ? (
          <EmbedDetails
            embed={selected}
            key={selected.id}
            onRevoked={() => setSelectedId(null)}
            organizationId={organizationId}
          />
        ) : null}
        <ResponsiveDialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {t("done")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
