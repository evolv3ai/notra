import { cn } from "@notra/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface DiagramProps {
  label?: string;
  caption?: string;
  children: ReactNode;
}

function useSeenOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return [ref, seen] as const;
}

export function Diagram({ label, caption, children }: DiagramProps) {
  const [ref, seen] = useSeenOnce<HTMLElement>();
  return (
    <figure
      className="not-prose my-10 font-mono text-sm"
      data-seen={seen ? "" : undefined}
      ref={ref}
    >
      {label ? (
        <div className="text-muted-foreground mb-4 text-xs tracking-widest uppercase">
          {label}
        </div>
      ) : null}
      {children}
      {caption ? (
        <figcaption className="text-muted-foreground mt-5 text-center font-sans text-sm">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

interface PanelProps {
  title?: ReactNode;
  aside?: ReactNode;
  step?: number;
  accent?: boolean;
  scan?: number;
  className?: string;
  children?: ReactNode;
}

export function Panel({
  title,
  aside,
  step,
  accent = false,
  scan,
  className,
  children,
}: PanelProps) {
  return (
    <div
      className={cn(
        "bg-card relative overflow-hidden rounded-xl border",
        accent ? "border-primary/50 bg-primary/[0.04]" : "border-border",
        className
      )}
    >
      {title ? (
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3",
            children ? "border-b" : null,
            accent ? "border-primary/30" : "border-border"
          )}
        >
          {step === undefined ? null : <StepSquare>{step}</StepSquare>}
          <span className="text-foreground min-w-0 flex-1 truncate">
            {title}
          </span>
          {aside ? (
            <span
              className={cn(
                "shrink-0",
                accent ? "text-primary" : "text-muted-foreground"
              )}
            >
              {aside}
            </span>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="px-4 py-3">{children}</div> : null}
      {scan === undefined ? null : <FlowScan accent={accent} delay={scan} />}
    </div>
  );
}

interface RowProps {
  k: ReactNode;
  v: ReactNode;
  accent?: boolean;
  muted?: boolean;
}

export function Row({ k, v, accent = false, muted = false }: RowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-1.5",
        muted ? "opacity-50" : null
      )}
    >
      <span className="text-muted-foreground">{k}</span>
      <span
        className={cn(
          "text-right",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {v}
      </span>
    </div>
  );
}

function StepSquare({ children }: { children: ReactNode }) {
  return (
    <span className="border-primary/40 text-primary bg-primary/10 grid size-5 shrink-0 place-items-center rounded-sm border text-xs">
      {children}
    </span>
  );
}

function StepCircle({
  children,
  accent,
}: {
  children: ReactNode;
  accent: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border text-xs",
        accent
          ? "border-primary/60 text-primary"
          : "border-muted-foreground/50 text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

type FlowAxis = "down" | "right" | "left";

const FLOW_TARGET: Record<FlowAxis, string> = {
  down: "translateY(100%)",
  right: "translateX(100%)",
  left: "translateX(-100%)",
};

interface FlowDotProps {
  axis?: FlowAxis;
  delay?: number;
  accent?: boolean;
  short?: boolean;
  linear?: boolean;
}

export function FlowDot({
  axis = "down",
  delay = 0,
  accent = true,
  short = false,
  linear = false,
}: FlowDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute motion-reduce:hidden",
        short ? "diagram-flow-travel-short" : "diagram-flow-travel",
        linear ? "diagram-flow-linear" : null,
        axis === "down" ? "inset-x-0 top-0 h-full" : "inset-y-0 w-full",
        axis === "left" ? "right-0" : null,
        axis === "right" ? "left-0" : null
      )}
      style={
        {
          "--flow-delay": delay,
          "--flow-target": FLOW_TARGET[axis],
        } as CSSProperties
      }
    >
      <span
        className={cn(
          "absolute size-1.5",
          axis === "down" ? "top-0 left-1/2 -translate-1/2" : null,
          axis === "right" ? "top-1/2 left-0 -translate-1/2" : null,
          axis === "left"
            ? "top-1/2 right-0 translate-x-1/2 -translate-y-1/2"
            : null,
          accent ? "text-primary" : "text-foreground"
        )}
      >
        <span
          className={cn(
            "absolute from-transparent to-current",
            axis === "down"
              ? "bottom-1/2 left-1/2 h-4 w-px -translate-x-1/2 bg-linear-to-b"
              : "top-1/2 h-px w-4 -translate-y-1/2",
            axis === "right" ? "right-1/2 bg-linear-to-r" : null,
            axis === "left" ? "left-1/2 bg-linear-to-l" : null
          )}
        />
        <span className="absolute inset-0 rounded-xs bg-current" />
      </span>
    </span>
  );
}

function FlowScan({ delay, accent }: { delay: number; accent: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
    >
      <span
        className={cn(
          "diagram-flow-scan absolute inset-0 border-b bg-linear-to-b from-transparent",
          accent
            ? "border-primary/70 to-primary/10"
            : "border-foreground/30 to-foreground/[0.05]"
        )}
        style={{ "--flow-delay": delay } as CSSProperties}
      />
    </span>
  );
}

interface ConnectorProps {
  step?: number;
  flowDelay?: number;
  label?: ReactNode;
  dashed?: boolean;
  accent?: boolean;
  className?: string;
}

export function Connector({
  step,
  label,
  dashed = false,
  accent = !dashed,
  flowDelay,
  className,
}: ConnectorProps) {
  return (
    <div className={cn("flex h-14 items-stretch gap-4 pl-8", className)}>
      <div className="relative flex w-px flex-col items-center">
        <span
          className={cn(
            "w-0 flex-1 border-l",
            dashed ? "border-dashed" : null,
            accent ? "border-primary" : "border-muted-foreground/60"
          )}
        />
        <ArrowHead accent={accent} />
        {flowDelay === undefined ? null : (
          <span className="absolute inset-x-0 top-0 bottom-1.5">
            <FlowDot accent={accent} delay={flowDelay} />
          </span>
        )}
      </div>
      {label ? (
        <div className="flex items-center gap-2.5">
          {step === undefined ? null : (
            <StepCircle accent={accent}>{step}</StepCircle>
          )}
          <span className={accent ? "text-primary" : "text-muted-foreground"}>
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ArrowHead({ accent }: { accent: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "-mt-px shrink-0",
        accent ? "text-primary" : "text-muted-foreground/60"
      )}
      height="6"
      viewBox="0 0 10 6"
      width="10"
    >
      <path d="M0 0 L5 6 L10 0 Z" fill="currentColor" />
    </svg>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
      {children}
    </div>
  );
}
