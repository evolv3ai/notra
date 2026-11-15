import { cn } from "@notra/ui/lib/utils";
import type { CSSProperties, ComponentType } from "react";

import {
  GitHubLogo,
  RailwayLogo,
  TinybirdLogo,
  VercelLogo,
  WorkOSLogo,
} from "@/components/blog-diagrams/logos";
import {
  Connector,
  Diagram,
  FlowDot,
  Legend,
  Panel,
  Row,
} from "@/components/blog-diagrams/primitives";

interface Swap {
  name: string;
  prod: string;
  demo: string;
  Logo?: ComponentType<{ className?: string }>;
}

const SWAPS: readonly Swap[] = [
  { name: "Login", prod: "WorkOS", demo: "signed cookie", Logo: WorkOSLogo },
  { name: "Models", prod: "AI providers", demo: "fake model" },
  {
    name: "Analytics",
    prod: "Tinybird",
    demo: "generated",
    Logo: TinybirdLogo,
  },
  {
    name: "Repos",
    prod: "GitHub App",
    demo: "fictional repo",
    Logo: GitHubLogo,
  },
];

function WithLogo({
  Logo,
  children,
}: {
  Logo?: ComponentType<{ className?: string }>;
  children: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {Logo ? <Logo /> : null}
      {children}
    </span>
  );
}

export function DemoDeploymentsDiagram() {
  return (
    <Diagram caption="Both deployments run the same code. The demo swaps the service behind each choke point.">
      <div className="flex flex-col items-center">
        <Panel
          aside="dashboard + api"
          className="w-full sm:w-80"
          scan={0}
          title="main"
        />
        <div className="hidden w-full sm:block">
          <div className="bg-border relative mx-auto h-5 w-px">
            <FlowDot accent={false} delay={0.11} short />
          </div>
          <div className="mx-auto flex h-5 w-[calc(50%+0.5rem)]">
            <span className="border-border relative flex-1 border-t border-l">
              <span className="absolute inset-x-0 -top-px h-px">
                <FlowDot accent={false} axis="left" delay={0.16} linear />
              </span>
              <span className="absolute inset-y-0 -left-px w-px">
                <FlowDot accent={false} delay={0.28} short />
              </span>
            </span>
            <span className="border-primary relative flex-1 border-r">
              <span className="from-border to-primary absolute inset-x-0 top-0 h-px bg-linear-to-r to-60%" />
              <span className="absolute inset-x-0 top-0 h-px">
                <FlowDot axis="right" delay={0.16} linear />
              </span>
              <span className="absolute inset-y-0 -right-px w-px">
                <FlowDot delay={0.28} short />
              </span>
            </span>
          </div>
        </div>
        <div className="mt-4 grid w-full gap-4 sm:mt-0 sm:grid-cols-2">
          <Panel aside="usenotra.com" scan={0.33} title="production">
            <Row
              k="Hosting"
              v={<WithLogo Logo={VercelLogo}>Vercel</WithLogo>}
            />
            {SWAPS.map((swap) => (
              <Row
                k={swap.name}
                key={swap.name}
                v={<WithLogo Logo={swap.Logo}>{swap.prod}</WithLogo>}
              />
            ))}
          </Panel>
          <Panel accent aside="demo.usenotra.com" scan={0.33} title="demo">
            <Row
              accent
              k="Hosting"
              v={<WithLogo Logo={RailwayLogo}>Railway</WithLogo>}
            />
            {SWAPS.map((swap) => (
              <Row accent k={swap.name} key={swap.name} v={swap.demo} />
            ))}
          </Panel>
        </div>
      </div>
    </Diagram>
  );
}

export function DemoCookieDiagram() {
  return (
    <Diagram
      caption="Anyone can read the payload, but only the server can produce a valid signature for it."
      label="The notra_demo cookie"
    >
      <div className="border-border flex overflow-hidden rounded-xl border text-base">
        <span className="bg-card text-foreground min-w-0 flex-[1.4] truncate px-4 py-4">
          eyJhbm9ueW1vdXNJZCI6…
        </span>
        <span className="bg-muted text-muted-foreground border-border border-x px-3 py-4">
          .
        </span>
        <span className="bg-primary/10 text-primary min-w-0 flex-1 truncate px-4 py-4">
          Qm9xT1h3c2Vk…
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <Panel aside="public" title="payload">
          <Row k="anonymousId" v="anon_k3J9…" />
          <Row k="encoding" v="base64url JSON" />
          <Row k="visible in" v="UI, API key metadata" />
        </Panel>
        <Panel accent aside="grants access" title="signature">
          <Row accent k="algorithm" v="HMAC-SHA256" />
          <Row accent k="check" v="timingSafeEqual" />
        </Panel>
      </div>
    </Diagram>
  );
}

const POOL_ROWS = [
  { id: "anon_k3J9…", note: "was pool_7Hc… · yours", state: "claimed" },
  { id: "pool_Q2mA…", note: "ready", state: "ready" },
  { id: "pool_x81L…", note: "ready", state: "ready" },
  { id: "pool_n4Tb…", note: "seeding", state: "refill" },
] as const;

export function DemoPoolDiagram() {
  return (
    <Diagram
      caption="Your first request claims a sandbox that was seeded earlier, which takes about 0.4 seconds."
      label="A first visit"
    >
      <Panel aside="no cookie" scan={0} title="GET /api/demo/enter" />
      <Connector
        flowDelay={0.11}
        label="claim · FOR UPDATE SKIP LOCKED"
        step={1}
      />
      <Panel accent aside="pool" scan={0.23} title="demo_sandboxes">
        {POOL_ROWS.map((row) => (
          <div
            className={cn(
              "my-1 flex items-center justify-between gap-4 rounded-md border px-3 py-2",
              row.state === "claimed"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-foreground",
              row.state === "refill"
                ? "text-muted-foreground border-dashed"
                : null
            )}
            key={row.id}
          >
            <span>{row.id}</span>
            <span
              className={
                row.state === "claimed"
                  ? "text-primary"
                  : "text-muted-foreground"
              }
            >
              {row.note}
            </span>
          </div>
        ))}
      </Panel>
      <Connector flowDelay={0.34} label="307 + signed cookie" step={2} />
      <Panel aside="your workspace" scan={0.46} title="/demo-xxxx/geo" />
      <Legend>
        <span className="flex items-center gap-2">
          <span className="border-muted-foreground/60 size-3 rounded-sm border border-dashed" />
          refilled after the response, one refill at a time
        </span>
      </Legend>
    </Diagram>
  );
}

const TIMELINE_DAYS = 14;

interface TimelineRow {
  label: string;
  seeded: readonly number[];
  yours: number;
  scheduled: number;
  now: number;
}

const TIMELINE_ROWS: readonly TimelineRow[] = [
  {
    label: "Monday",
    seeded: [1, 2, 4, 6, 8],
    yours: 10,
    scheduled: 12,
    now: 10,
  },
  {
    label: "Tuesday",
    seeded: [2, 3, 5, 7, 9],
    yours: 10,
    scheduled: 13,
    now: 11,
  },
];

function TimelineCell({ row, day }: { row: TimelineRow; day: number }) {
  const isSeeded = row.seeded.includes(day);
  const isYours = row.yours === day;
  const isScheduled = row.scheduled === day;

  return (
    <span
      className={cn(
        "h-10 rounded-xs sm:h-12",
        isSeeded ? "bg-primary" : null,
        isYours ? "bg-foreground" : null,
        isScheduled ? "border-primary border-2" : null,
        isSeeded || isYours || isScheduled
          ? null
          : "border-border border border-dashed"
      )}
    />
  );
}

export function DemoRebaseDiagram() {
  return (
    <Diagram
      caption="On a new day, seeded events and scheduled posts move forward by the time since the anchor, and your own post keeps its timestamp."
      label="Rebase on a new local day"
    >
      <div className="space-y-8">
        {TIMELINE_ROWS.map((row) => (
          <div
            className="grid gap-3 sm:grid-cols-[7rem_1fr] sm:items-end"
            key={row.label}
          >
            <span className="text-foreground sm:pb-3">{row.label}</span>
            <div
              className="relative"
              style={
                {
                  "--now": `${(row.now / TIMELINE_DAYS) * 100}%`,
                } as CSSProperties
              }
            >
              <div className="text-foreground absolute -top-6 left-(--now) pl-2 text-xs whitespace-nowrap">
                now
              </div>
              <div className="bg-foreground absolute -top-1 -bottom-1 left-[calc(var(--now)+1px)] w-px" />
              <div className="grid grid-cols-14 gap-1">
                {Array.from({ length: TIMELINE_DAYS }, (_, index) => (
                  <TimelineCell day={index + 1} key={index} row={row} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Legend>
        <span className="flex items-center gap-2">
          <span className="bg-primary size-3 rounded-sm" />
          seeded event
        </span>
        <span className="flex items-center gap-2">
          <span className="bg-foreground size-3 rounded-sm" />
          your post
        </span>
        <span className="flex items-center gap-2">
          <span className="border-primary size-3 rounded-sm border-2" />
          scheduled post
        </span>
        <span className="opacity-60">1 cell = 1 day</span>
      </Legend>
    </Diagram>
  );
}

const FEED = [
  {
    method: "POST",
    path: "/v1/posts",
    status: 201,
    source: "API",
    when: "now",
  },
  {
    method: "GET",
    path: "/v1/posts",
    status: 200,
    source: "Console",
    when: "2m",
  },
  {
    method: "PATCH",
    path: "/v1/posts/…",
    status: 200,
    source: "UI",
    when: "5m",
  },
] as const;

export function DemoApiFlowDiagram() {
  return (
    <Diagram
      caption="A post created with curl appears in the open dashboard, together with the request that created it."
      label="One request, live in the dashboard"
    >
      <Panel aside="your terminal" scan={0} title="curl" />
      <Connector
        flowDelay={0.11}
        label="POST /v1/posts · Bearer notra_demo_…"
        step={1}
      />
      <Panel aside="apps/api" scan={0.23} title="demo-api.usenotra.com">
        <Row k="key" v="Unkey, separate workspace" />
        <Row k="limit" v="60 req/min" />
        <Row k="writes" v="post + demo_request_log" />
      </Panel>
      <Connector
        flowDelay={0.34}
        label="Upstash Realtime · demo:<orgId>"
        step={2}
      />
      <Panel accent aside="live" scan={0.46} title="Dashboard · API feed">
        {FEED.map((entry, index) => (
          <div
            className={cn(
              "grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-3 py-1.5",
              index === 0 ? "text-primary" : "text-muted-foreground"
            )}
            key={`${entry.method}-${entry.path}-${entry.when}`}
          >
            <span>{entry.method}</span>
            <span className={index === 0 ? "text-primary" : "text-foreground"}>
              {entry.path}
            </span>
            <span>
              {entry.status} · {entry.source} · {entry.when}
            </span>
          </div>
        ))}
      </Panel>
    </Diagram>
  );
}
