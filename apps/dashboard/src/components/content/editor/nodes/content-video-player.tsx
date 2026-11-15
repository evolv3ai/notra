"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import {
  FullScreenIcon,
  MinimizeScreenIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import type { ContentVideoPlayerProps } from "@/types/content/video-player";

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function ContentVideoPlayer({
  src,
  videoClassName,
}: ContentVideoPlayerProps) {
  const t = useTranslations("content.editor.video");
  const tCommon = useTranslations("common");
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === frameRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      video.play().catch(() => setPlaying(false));
      return;
    }
    video.pause();
  }

  function toggleMuted() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    if (document.fullscreenElement === frame) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    frame.requestFullscreen().catch(() => undefined);
  }

  function seek(next: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(next)) {
      return;
    }
    video.currentTime = next;
    setCurrent(next);
  }

  return (
    <div
      className={
        fullscreen
          ? "flex h-full flex-col overflow-hidden bg-black"
          : "bg-background ring-foreground/10 overflow-hidden rounded-xl ring-1"
      }
      ref={frameRef}
    >
      <div
        className={
          fullscreen ? "relative min-h-0 flex-1 bg-black" : "relative bg-black"
        }
      >
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- uploads do not include a caption file */}
        <video
          aria-label={tCommon("labels.video")}
          className={cn(
            fullscreen
              ? "h-full w-full object-contain"
              : ["max-h-128 w-full", videoClassName]
          )}
          onDurationChange={(event) =>
            setDuration(event.currentTarget.duration)
          }
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={src}
        />
        <button
          aria-label={playing ? t("pause") : t("play")}
          className="focus-visible:outline-ring absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
          onClick={togglePlay}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {playing ? null : (
            <span
              aria-hidden
              className="bg-background/95 text-foreground ring-foreground/10 flex size-12 items-center justify-center rounded-full ring-1"
            >
              <HugeiconsIcon
                className="ml-0.5 size-5"
                icon={PlayIcon}
                strokeWidth={2}
              />
            </span>
          )}
        </button>
      </div>
      <div className="border-border bg-background flex items-center gap-1.5 border-t px-2 py-1.5">
        <Button
          aria-label={playing ? t("pause") : t("play")}
          onClick={togglePlay}
          onMouseDown={(event) => event.preventDefault()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            className={playing ? undefined : "ml-0.5"}
            icon={playing ? PauseIcon : PlayIcon}
            strokeWidth={2}
          />
        </Button>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatClock(current)}
          <span className="px-1">/</span>
          {formatClock(duration)}
        </span>
        <SliderPrimitive.Root
          className="min-w-0 flex-1"
          disabled={!Number.isFinite(duration) || duration <= 0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 1}
          min={0}
          onValueChange={(next) => seek(next)}
          step={0.1}
          thumbAlignment="edge"
          value={Number.isFinite(current) ? current : 0}
        >
          <SliderPrimitive.Control className="group/seek flex h-6 w-full cursor-pointer touch-none items-center select-none data-[disabled]:cursor-not-allowed">
            <SliderPrimitive.Track className="bg-muted relative h-1 w-full rounded-full">
              <SliderPrimitive.Indicator className="bg-foreground rounded-full" />
              <SliderPrimitive.Thumb
                aria-label={t("seek")}
                className="bg-foreground focus-visible:ring-ring/50 size-3 rounded-full opacity-0 transition-opacity outline-none group-hover/seek:opacity-100 focus-visible:opacity-100 focus-visible:ring-4 data-[dragging]:opacity-100"
                getAriaValueText={() =>
                  `${formatClock(current)} / ${formatClock(duration)}`
                }
              />
            </SliderPrimitive.Track>
          </SliderPrimitive.Control>
        </SliderPrimitive.Root>
        <Button
          aria-label={muted ? t("unmute") : t("mute")}
          aria-pressed={muted}
          onClick={toggleMuted}
          onMouseDown={(event) => event.preventDefault()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            icon={muted ? VolumeOffIcon : VolumeHighIcon}
            strokeWidth={2}
          />
        </Button>
        <Button
          aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
          onClick={toggleFullscreen}
          onMouseDown={(event) => event.preventDefault()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            icon={fullscreen ? MinimizeScreenIcon : FullScreenIcon}
            strokeWidth={2}
          />
        </Button>
      </div>
    </div>
  );
}
