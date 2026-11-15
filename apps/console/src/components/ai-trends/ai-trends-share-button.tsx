"use client";

import {
  Copy01Icon,
  Download04Icon,
  Image02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import { Button } from "@notra/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";

import { AI_TRENDS_SHARE_PATH } from "@/constants/ai-trends";
import type {
  AiTrendsShareButtonProps,
  AiTrendsShareCard,
  AiTrendsShareDraft,
  AiTrendsShareImage,
} from "@/types/ai-trends";

/** The light-mode logo `EngineIcon` draws, as markup the image route can embed. */
function engineLogoSvg(engine: string): string | null {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<EngineIcon engine={engine} />));
  const svg = host.querySelector("svg")?.outerHTML ?? null;
  root.unmount();
  return svg;
}

function withLogos(
  draft: AiTrendsShareDraft
): Omit<AiTrendsShareCard, "theme"> {
  const svgs = new Map<string, string | null>();
  const svgFor = (engine: string) => {
    if (!svgs.has(engine)) {
      svgs.set(engine, engineLogoSvg(engine));
    }
    return svgs.get(engine) ?? null;
  };
  return {
    ...draft,
    icons: draft.icons.flatMap((icon): AiTrendsShareCard["icons"] => {
      if (icon.kind === "domain") {
        return [icon];
      }
      const svg = svgFor(icon.engine);
      return svg ? [{ kind: "engine" as const, svg }] : [];
    }),
    series: draft.series.map((series) => ({
      ...series,
      logo: series.logo ? svgFor(series.logo) : null,
    })),
  };
}

/** Opens a preview of the chart as a Notra share image to download or copy. */
export function AiTrendsShareButton({
  card,
  name,
  label = "Share image",
}: AiTrendsShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<Omit<
    AiTrendsShareCard,
    "theme"
  > | null>(null);
  const [theme, setTheme] = useState<AiTrendsShareCard["theme"]>("light");
  const [image, setImage] = useState<AiTrendsShareImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPreview = () => {
    const draft = card();
    const next = draft ? withLogos(draft) : null;
    setImage(null);
    setError(next ? null : "This chart has nothing to share yet.");
    setPayload(next);
    setOpen(true);
  };

  useEffect(() => {
    if (!payload) {
      return;
    }
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setImage(null);
    setError(null);
    fetch(AI_TRENDS_SHARE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, theme }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Rendering failed (${response.status})`);
        }
        const blob = await response.blob();
        if (controller.signal.aborted) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImage({ blob, url: objectUrl });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Rendering failed");
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [payload, theme]);

  const copy = async () => {
    if (!image) {
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [image.blob.type]: image.blob }),
      ]);
      toast.success("Image copied");
    } catch {
      toast.error("Your browser blocked copying the image");
    }
  };

  return (
    <>
      <Button
        aria-label={label}
        onClick={openPreview}
        size="icon-sm"
        title={label}
        variant="ghost"
      >
        <HugeiconsIcon icon={Image02Icon} />
      </Button>
      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPayload(null);
          }
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Share image</DialogTitle>
            <DialogDescription>
              The chart as a Notra-branded PNG, ready for X, LinkedIn or a post.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 relative aspect-[8/5] w-full overflow-hidden rounded-lg border">
            {image ? (
              // biome-ignore lint/performance/noImgElement: a local blob URL needs no optimization
              <img
                alt="Chart as it will be shared"
                className="size-full object-contain"
                src={image.url}
              />
            ) : null}
            {!(image || error) ? <Skeleton className="size-full" /> : null}
            {error ? (
              <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="sm:justify-between">
            <Tabs
              onValueChange={(next) =>
                setTheme(next === "dark" ? "dark" : "light")
              }
              value={theme}
            >
              <TabsList>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <Button disabled={!image} onClick={copy} variant="outline">
                <HugeiconsIcon icon={Copy01Icon} />
                Copy
              </Button>
              <Button
                disabled={!image}
                nativeButton={false}
                render={
                  <a
                    download={`${name}${theme === "dark" ? "-dark" : ""}.png`}
                    href={image?.url}
                  />
                }
              >
                <HugeiconsIcon icon={Download04Icon} />
                Download PNG
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
