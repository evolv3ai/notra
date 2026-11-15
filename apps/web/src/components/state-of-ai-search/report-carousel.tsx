"use client";

import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@notra/ui/components/ui/carousel";
import { CarouselProgress } from "@notra/ui/components/ui/carousel-progress";
import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ReportPanel } from "@/components/state-of-ai-search/report-section";
import {
  LeaderList,
  ReadReportRow,
} from "@/components/state-of-ai-search/report-ui";
import type { StateOfAiSearchSummary } from "@/types/state-of-ai-search";

const PROGRESS_FULL = 100;
const WHEEL_SWIPE_THRESHOLD = 40;
const WHEEL_GESTURE_GAP_MS = 180;
const WHEEL_MIN_SWIPE_INTERVAL_MS = 300;
const WHEEL_DECAY_RATIO = 0.5;
const WHEEL_RESTART_RATIO = 2.5;
const WHEEL_RESTART_MIN_DELTA = 12;

function useWheelSwipe(api: CarouselApi) {
  useEffect(() => {
    const root = api?.rootNode();
    if (!(api && root)) {
      return;
    }
    let distance = 0;
    let fired = false;
    let firedAt = 0;
    let peak = 0;
    let coasting = false;
    let floor = Number.POSITIVE_INFINITY;
    let gestureEnd: number | undefined;
    const reset = () => {
      distance = 0;
      fired = false;
      peak = 0;
      coasting = false;
      floor = Number.POSITIVE_INFINITY;
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      event.preventDefault();
      window.clearTimeout(gestureEnd);
      gestureEnd = window.setTimeout(reset, WHEEL_GESTURE_GAP_MS);

      const delta = Math.abs(event.deltaX);
      if (fired) {
        const settled =
          event.timeStamp - firedAt >= WHEEL_MIN_SWIPE_INTERVAL_MS;
        const reversed =
          delta >= WHEEL_RESTART_MIN_DELTA &&
          Math.sign(event.deltaX) !== Math.sign(distance);
        const restarted =
          coasting &&
          delta >= WHEEL_RESTART_MIN_DELTA &&
          delta >= floor * WHEEL_RESTART_RATIO;
        if (settled && (reversed || restarted)) {
          reset();
        } else {
          peak = Math.max(peak, delta);
          if (delta <= peak * WHEEL_DECAY_RATIO) {
            coasting = true;
          }
          if (coasting) {
            floor = Math.min(floor, delta);
          }
          return;
        }
      }
      peak = Math.max(peak, delta);
      distance += event.deltaX;
      if (Math.abs(distance) >= WHEEL_SWIPE_THRESHOLD) {
        fired = true;
        firedAt = event.timeStamp;
        if (distance > 0) {
          api.scrollNext();
        } else {
          api.scrollPrev();
        }
      }
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      window.clearTimeout(gestureEnd);
    };
  }, [api]);
}

function ReportBoard({
  report,
  active,
}: {
  report: StateOfAiSearchSummary;
  active: boolean;
}) {
  return (
    <Link
      aria-label={`Read the ${report.subject} report`}
      className={cn(
        "group focus-visible:outline-ring block rounded-2xl outline-offset-2 transition-[opacity,scale] duration-300 ease-out focus-visible:outline-2 motion-reduce:transition-none",
        active ? "opacity-100" : "scale-[0.96] opacity-50 hover:opacity-75"
      )}
      draggable={false}
      params={{ category: report.slug, edition: report.edition }}
      to="/state-of-ai-search/$category/$edition"
    >
      <ReportPanel
        bodyClassName="flex flex-col"
        header={
          <>
            <span className="text-foreground">{report.subject}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {report.engines.map((engine) => (
                <EngineIcon
                  className="size-3.5"
                  engine={engine.model}
                  key={engine.id}
                />
              ))}
            </span>
          </>
        }
      >
        <div className="border-border/60 flex items-baseline justify-between gap-4 border-b px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Best {report.noun}, according to AI
          </p>
          <span className="text-muted-foreground shrink-0 text-xs">
            {report.editionLabel}
          </span>
        </div>
        <LeaderList leaders={report.leaders} />
        <ReadReportRow subject={report.subject} />
      </ReportPanel>
    </Link>
  );
}

export function ReportCarousel({
  reports,
}: {
  reports: StateOfAiSearchSummary[];
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  useWheelSwipe(api);

  useEffect(() => {
    if (!api) {
      return;
    }
    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <div className="flex flex-col gap-4">
      <Carousel
        className="[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
        opts={{ align: "center", loop: true }}
        setApi={setApi}
      >
        <CarouselContent>
          {reports.map((report, index) => (
            <CarouselItem
              className="basis-[88%] sm:basis-[70%] lg:basis-[52%]"
              key={report.slug}
            >
              <ReportBoard active={index === selected} report={report} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="bg-background/90 left-4 hidden backdrop-blur-sm sm:inline-flex" />
        <CarouselNext className="bg-background/90 right-4 hidden backdrop-blur-sm sm:inline-flex" />
      </Carousel>
      <CarouselProgress
        activeIndex={selected}
        labels={reports.map((report) => `${report.subject} report`)}
        onSelect={(index) => api?.scrollTo(index)}
        progress={PROGRESS_FULL}
      />
    </div>
  );
}
