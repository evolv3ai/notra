import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Databuddy } from "@notra/ui/components/ui/svgs/databuddy";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";

import { C15tLogo, GitHubLogo } from "@/components/blog-diagrams/logos";
import {
  Connector,
  Diagram,
  Panel,
  Row,
} from "@/components/blog-diagrams/primitives";
import {
  ContentIcon,
  ImagesIcon,
  ProjectsIcon,
  ReferencesIcon,
  TrafficIcon,
  ZdrIcon,
} from "@/components/landing/pricing-icons";
import { TrackedSignupLink } from "@/components/tracked-signup-link";

const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

function WithLogo({
  Logo,
  children,
}: {
  Logo: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function Window({
  address,
  controls,
  children,
}: {
  address: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_0.0625rem_0.125rem_#0A0D140A,0_0.25rem_1rem_#0A0D140F] dark:shadow-none">
      <div className="border-border flex items-center gap-3 border-b px-3 py-2.5">
        <div aria-hidden="true" className="hidden gap-1.5 sm:flex">
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </div>
        <div className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded-md px-3 py-1 font-mono text-xs">
          {address}
        </div>
        {controls}
      </div>
      {children}
    </div>
  );
}

export function SitesDeployDiagram() {
  return (
    <Diagram
      caption="A failed build never touches the live site. A Notra Sites check on the commit lists every error with its file and line."
      label="A deploy"
    >
      <Panel
        aside="blog/launch.mdx"
        scan={0}
        title={<WithLogo Logo={GitHubLogo}>git push</WithLogo>}
      />
      <Connector flowDelay={0.11} label="build the exact commit" step={1} />
      <Panel
        accent
        aside="no network, no secrets"
        scan={0.23}
        title="build sandbox"
      >
        <Row accent k="pages" v="static HTML + Markdown" />
        <Row accent k="search" v="sitemaps, RSS, JSON-LD" />
        <Row accent k="agents" v="llms.txt, llms-full.txt" />
        <Row accent k="social" v="OG image for every post" />
      </Panel>
      <Connector
        flowDelay={0.34}
        label="upload, check, switch live in one step"
        step={2}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel accent aside="push to main" scan={0.46} title="blog.acme.com">
          <Row accent k="visitors" v="everyone" />
          <Row accent k="indexed" v="yes" />
        </Panel>
        <Panel aside="pull request" scan={0.46} title="pr-42--acme.notra.site">
          <Row k="visitors" v="your team" />
          <Row k="indexed" v="never" />
        </Panel>
      </div>
    </Diagram>
  );
}

const READERS = [
  { id: "person", label: "Person" },
  { id: "agent", label: "AI agent" },
] as const;

type Reader = (typeof READERS)[number]["id"];

const AGENT_TONE = {
  muted: "text-muted-foreground",
  body: "text-foreground",
} as const;

const AGENT_LINES: {
  key?: string;
  text: string;
  tone: keyof typeof AGENT_TONE;
}[] = [
  {
    text: '$ curl -i -H "Accept: text/markdown" acme.com/blog/launch',
    tone: "muted",
  },
  { key: "x-robots-tag", text: "noindex", tone: "body" },
  {
    key: "link",
    text: '<https://acme.com/blog/launch>; rel="canonical"',
    tone: "body",
  },
  { text: "", tone: "body" },
  { text: "# Acme Flow is live", tone: "body" },
  { text: "", tone: "body" },
  { text: "- Published: 2026-09-28", tone: "muted" },
  { text: "- Authors: Jan Burzinski", tone: "muted" },
  { text: "", tone: "body" },
  {
    text: "Acme Flow ships today. Write a post, push it, and it's live:",
    tone: "body",
  },
  { text: "", tone: "body" },
  { text: "- Publish from GitHub", tone: "body" },
  { text: "- Previews for every pull request", tone: "body" },
];

function stackLayer(hidden: boolean) {
  return cn(
    "transition-[opacity,filter] duration-200 ease-out [grid-area:stack]",
    hidden ? "pointer-events-none opacity-0 blur-[2px]" : null
  );
}

export function SitesReadersDemo() {
  const [reader, setReader] = useState<Reader>("person");
  const isAgent = reader === "agent";

  const toggle = (
    <div
      aria-label="Request the page as"
      className="bg-muted relative grid shrink-0 grid-cols-2 rounded-md p-0.5 font-sans text-xs font-medium"
      role="group"
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-background absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[0.3125rem] shadow-sm transition-transform duration-200",
          EASE_OUT,
          isAgent ? "translate-x-full" : null
        )}
      />
      {READERS.map((option) => (
        <button
          aria-pressed={reader === option.id}
          className={cn(
            "relative px-3 py-1 transition-colors",
            reader === option.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={option.id}
          onClick={() => setReader(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <figure className="not-prose my-10">
      <Window address="acme.com/blog/launch" controls={toggle}>
        <div className="grid [grid-template-areas:'stack']">
          <div aria-hidden={isAgent} className={stackLayer(isAgent)}>
            <div className="flex h-full flex-col justify-center px-6 py-8 font-sans sm:px-10">
              <div className="text-muted-foreground text-xs">
                Sep 28, 2026 · Jan Burzinski
              </div>
              <div className="font-display text-foreground mt-2 text-3xl font-medium tracking-[-0.02em]">
                Acme Flow is live
              </div>
              <p className="text-foreground/80 mt-5 text-sm leading-6">
                Acme Flow ships today. Write a post, push it, and it&apos;s
                live:
              </p>
              <ul className="text-foreground/80 mt-2 space-y-1 text-sm">
                <li>• Publish from GitHub</li>
                <li>• Previews for every pull request</li>
              </ul>
            </div>
          </div>
          <div aria-hidden={!isAgent} className={stackLayer(!isAgent)}>
            <pre className="overflow-x-auto px-6 py-6 font-mono text-xs leading-5 sm:px-10">
              {AGENT_LINES.map((line, index) => (
                <span
                  className={cn("block min-h-5", AGENT_TONE[line.tone])}
                  key={index}
                >
                  {line.key ? (
                    <>
                      <span className="text-primary">{line.key}</span>:{" "}
                    </>
                  ) : null}
                  {line.text}
                </span>
              ))}
            </pre>
          </div>
        </div>
      </Window>
      <figcaption className="text-muted-foreground mt-4 text-center font-sans text-sm">
        Same URL, same post. Switch who&apos;s asking.
      </figcaption>
    </figure>
  );
}

type Choice = "pending" | "accepted" | "rejected";

interface LogRow {
  what: ReactNode;
  status: string;
  tone: "ok" | "wait" | "off";
}

const DATABUDDY_ROW = <WithLogo Logo={Databuddy}>databuddy.js</WithLogo>;

const LOG_ROWS: Record<Choice, LogRow[]> = {
  pending: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "waiting", tone: "wait" },
    { what: "Notra page view", status: "waiting", tone: "wait" },
  ],
  accepted: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "loaded", tone: "ok" },
    { what: "page_view → Databuddy", status: "sent", tone: "ok" },
    { what: "web vitals → Databuddy", status: "sent", tone: "ok" },
    { what: "Notra page view", status: "counted", tone: "ok" },
  ],
  rejected: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "blocked", tone: "off" },
    { what: "Notra page view", status: "not counted", tone: "off" },
  ],
};

const TONE_CLASS: Record<LogRow["tone"], string> = {
  ok: "text-primary",
  wait: "text-muted-foreground",
  off: "text-muted-foreground",
};

function ConsentButton({
  children,
  primary = false,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.97]",
        primary
          ? "bg-foreground text-background"
          : "border-border text-foreground border"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function SitesConsentDemo() {
  const [choice, setChoice] = useState<Choice>("pending");
  const decided = choice !== "pending";

  return (
    <figure className="not-prose my-10">
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <Window address="acme.com/blog/launch">
          <div className="relative h-64 overflow-hidden px-6 py-6 font-sans">
            <div className="font-display text-foreground text-xl font-medium tracking-[-0.02em]">
              Acme Flow is live
            </div>
            <div aria-hidden="true" className="mt-4 space-y-2.5">
              <div className="bg-muted h-2 w-full rounded-full" />
              <div className="bg-muted h-2 w-11/12 rounded-full" />
              <div className="bg-muted h-2 w-4/5 rounded-full" />
              <div className="bg-muted h-2 w-2/3 rounded-full" />
            </div>

            <div
              aria-hidden={decided}
              className={cn(
                "border-border bg-background absolute inset-x-3 bottom-3 rounded-lg border p-3 shadow-[0_0.25rem_1rem_#0A0D1414] transition-[transform,opacity] duration-200",
                EASE_OUT,
                decided
                  ? "pointer-events-none translate-y-[calc(100%+0.75rem)] opacity-0"
                  : null
              )}
            >
              <div className="text-foreground flex items-center gap-2 text-xs font-medium">
                <C15tLogo className="size-3.5" />
                We use cookies to measure visits.
              </div>
              <div className="mt-3 flex gap-2">
                <ConsentButton onClick={() => setChoice("rejected")}>
                  Reject
                </ConsentButton>
                <ConsentButton primary onClick={() => setChoice("accepted")}>
                  Accept
                </ConsentButton>
              </div>
            </div>

            <button
              aria-hidden={!decided}
              className={cn(
                "text-muted-foreground hover:text-foreground absolute bottom-3 left-6 text-xs underline-offset-4 transition-[opacity,color] duration-200 hover:underline",
                decided ? null : "pointer-events-none opacity-0"
              )}
              onClick={() => setChoice("pending")}
              tabIndex={decided ? 0 : -1}
              type="button"
            >
              Privacy settings
            </button>
          </div>
        </Window>

        <div className="border-border bg-card rounded-xl border p-4 font-mono text-xs">
          <div className="text-muted-foreground mb-3 tracking-widest uppercase">
            What loads
          </div>
          <ul aria-live="polite" className="space-y-1">
            {LOG_ROWS[choice].map((row, index) => (
              <li
                className="animate-in fade-in slide-in-from-bottom-1 flex items-center justify-between gap-4 py-1.5 duration-300 [animation-fill-mode:both] motion-reduce:animate-none"
                key={`${choice}-${index}`}
                style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
              >
                <span className="text-foreground flex min-w-0 items-center">
                  {row.what}
                </span>
                <span className={cn("shrink-0", TONE_CLASS[row.tone])}>
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="text-muted-foreground mt-4 text-center font-sans text-sm">
        Accept or reject the banner to see what loads. Choices are stored in
        your own c15t backend, and AI crawlers are always counted.
      </figcaption>
    </figure>
  );
}

const FREE_PLAN_FEATURES = [
  {
    Icon: ProjectsIcon,
    label: "1 site and 1 custom domain",
    subtitle: "with a “Powered by Notra” badge",
  },
  {
    Icon: ReferencesIcon,
    label: "Deploys from your GitHub repo",
    subtitle: "with a preview for every pull request",
  },
  { Icon: ContentIcon, label: "Markdown, llms.txt and sitemaps" },
  { Icon: ImagesIcon, label: "OG image for every post" },
  { Icon: TrafficIcon, label: "Visitor and AI agent analytics" },
  { Icon: ZdrIcon, label: "Databuddy and c15t integrations" },
] as const;

export function SitesFreePlanCard() {
  return (
    <aside className="not-prose my-10 grid gap-1.75 rounded-3xl bg-[#F7F7F7] p-1.75 sm:grid-cols-2 dark:bg-white/[0.04]">
      <div className="flex flex-col justify-between gap-8 rounded-2xl bg-white p-6 shadow-[0_0.125rem_0.3125rem_#00000008] dark:bg-white/[0.04]">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-[1.375rem] leading-7 font-medium tracking-[0.01em] text-black dark:text-white">
            Notra Sites
          </h3>
          <p className="font-sans text-[0.9375rem] leading-5 font-normal tracking-[-0.015em] text-[#6B6B6B] dark:text-white/60">
            Your blog and changelog, hosted on your domain and ready for AI
            agents.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[2.625rem] leading-13 font-normal tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
              $0
            </span>
            <span className="font-sans text-sm leading-[1.125rem] font-normal tracking-[-0.015em] text-[#1E1E1EB3] dark:text-white/60">
              for your first site
            </span>
          </div>
          <CtaButton
            className="w-full"
            nativeButton={false}
            render={<TrackedSignupLink source="blog-notra-sites" />}
            variant="primary"
          >
            <span>Create your site</span>
            <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
          </CtaButton>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6">
        <span className="font-sans text-sm leading-[1.125rem] font-medium text-[#1E1E1E] dark:text-white">
          Included on the Free plan
        </span>
        <ul className="flex flex-col gap-3.5">
          {FREE_PLAN_FEATURES.map(({ Icon, label, ...feature }) => (
            <li className="flex items-center gap-2.5" key={label}>
              <span className="shrink-0 text-[#1E1E1EBF] dark:text-white/60">
                <Icon className="size-6" />
              </span>
              <div className="flex flex-col">
                <span className="font-sans text-sm leading-[1.125rem] font-normal text-[#1E1E1EBF] dark:text-white/70">
                  {label}
                </span>
                {"subtitle" in feature ? (
                  <span className="font-sans text-xs leading-4 font-normal text-[#1E1E1EB3] dark:text-white/50">
                    {feature.subtitle}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
