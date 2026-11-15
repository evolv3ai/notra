"use client";

import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, useState } from "react";
import { useTranslations } from "use-intl";

import {
  SITE_PREVIEW_VIEWPORT_HEIGHT,
  SITE_PREVIEW_VIEWPORT_WIDTH,
  SITE_PREVIEW_REACHABILITY_STALE_MS,
} from "@/constants/sites";
import { cn } from "@/lib/utils";
import type { SitePreviewFrameProps } from "@/types/components/sites";
import { isSitePreviewReachable } from "@/utils/site-preview-reachability";

export function SitePreviewFrame({
  url,
  className,
  fallback,
}: SitePreviewFrameProps) {
  const t = useTranslations("sites.previewFrame");
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const reachability = useQuery({
    queryKey: ["site-preview-reachability", url],
    queryFn: ({ signal }) =>
      url ? isSitePreviewReachable(url, signal) : false,
    enabled: Boolean(url),
    retry: false,
    staleTime: SITE_PREVIEW_REACHABILITY_STALE_MS,
  });
  const reachable = reachability.data === true;
  const unavailable =
    !url || reachability.data === false || (reachability.isError && !reachable);
  const [width, setWidth] = useState(0);
  const scale = width > 0 ? width / SITE_PREVIEW_VIEWPORT_WIDTH : 0;

  return (
    <div
      className={cn(
        "bg-shell relative aspect-[16/10] overflow-hidden rounded-xl outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10",
        className
      )}
      ref={(node) => {
        if (!node) {
          return;
        }
        const observer = new ResizeObserver(([entry]) => {
          setWidth(entry?.contentRect.width ?? 0);
        });
        observer.observe(node);
        return () => observer.disconnect();
      }}
    >
      {url && reachable && scale > 0 ? (
        <iframe
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 h-(--preview-height) w-(--preview-width) origin-top-left scale-(--preview-scale) border-0 transition-opacity duration-300",
            loadedUrl === url ? "opacity-100" : "opacity-0"
          )}
          key={url}
          loading="lazy"
          onLoad={() => setLoadedUrl(url)}
          sandbox="allow-same-origin"
          src={url}
          style={
            {
              "--preview-width": `${SITE_PREVIEW_VIEWPORT_WIDTH}px`,
              "--preview-height": `${SITE_PREVIEW_VIEWPORT_HEIGHT}px`,
              "--preview-scale": scale,
            } as CSSProperties
          }
          tabIndex={-1}
          title={t("title")}
        />
      ) : null}
      {unavailable ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="bg-background text-muted-foreground max-w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-pretty">
            {url ? t("unavailable") : (fallback ?? t("unavailable"))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
