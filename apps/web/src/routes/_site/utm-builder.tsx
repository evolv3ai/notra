import { createFileRoute } from "@tanstack/react-router";
import { DataTable, type TableColumn } from "ui/table";

import { MarketingHeroWash } from "@/components/marketing-hero-wash";
import { UtmBuilderTool } from "@/components/utm-builder/utm-builder-tool";
import {
  GA4_CHANNEL_RULES,
  GA4_PAID_MEDIUM_NOTE,
  UTM_BUILDER_DESCRIPTION,
  UTM_BUILDER_HERO_SUBTITLE,
  UTM_BUILDER_MARKDOWN_URL,
  UTM_BUILDER_TITLE,
  UTM_BUILDER_URL,
  UTM_FIELDS,
} from "@/constants/utm-builder";
import type { Metadata } from "@/types/metadata";
import type { Ga4ChannelRule, UtmField } from "@/types/utm-builder";
import { buildHead } from "@/utils/head";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import {
  DEFAULT_SOCIAL_IMAGE,
  pageAlternates,
  TWITTER_HANDLE,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const title = UTM_BUILDER_TITLE;
const description = UTM_BUILDER_DESCRIPTION;
const url = UTM_BUILDER_URL;

const metadata: Metadata = {
  title,
  description,
  alternates: pageAlternates(url),
  openGraph: {
    title,
    description,
    url,
    type: "website",
    siteName: "Notra",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_SOCIAL_IMAGE.url],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: title, url },
]);

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: title,
  url,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const sectionTitleClass =
  "font-display text-[1.625rem]/8 font-medium tracking-[-0.02em] text-[#1E1E1E] dark:text-white";
const bodyClass =
  "font-sans text-[0.9375rem]/6 text-pretty text-[#1E1E1EBF] dark:text-white/70";
const codeClass =
  "rounded-md bg-[#1E1E1E0D] px-1.5 py-0.5 font-mono text-[0.8125rem] dark:bg-white/10";

const PARAMETER_COLUMNS: TableColumn<UtmField>[] = [
  {
    key: "param",
    header: "Parameter",
    width: "14rem",
    cell: (field) => <span className="font-mono">{field.param}</span>,
  },
  {
    key: "requirement",
    header: "Need",
    width: "9rem",
    cell: (field) => <span className="capitalize">{field.requirement}</span>,
  },
  { key: "description", header: "What it is", width: "1fr" },
];

const GA4_RULE_COLUMNS: TableColumn<Ga4ChannelRule>[] = [
  {
    key: "channel",
    header: "Channel",
    width: "12rem",
    cell: (rule) => <span className="font-medium">{rule.channel}</span>,
  },
  { key: "rule", header: "Rule", width: "1fr" },
];

const EXAMPLE_CALL = `${UTM_BUILDER_MARKDOWN_URL}?url=example.com&campaign=spring-launch&channels=newsletter,linkedin,google-ads`;

export const Route = createFileRoute("/_site/utm-builder")({
  head: () => buildHead(metadata),
  component: UtmBuilderPage,
});

function UtmBuilderPage() {
  return (
    <div className="flex w-full flex-col items-center">
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }}
        type="application/ld+json"
      />

      <section className="flex w-full flex-col items-center gap-10 pb-16 antialiased [font-synthesis:none] md:gap-12 md:pb-24">
        <MarketingHeroWash
          subtitle={UTM_BUILDER_HERO_SUBTITLE}
          title={
            <>
              UTM links that land in the{" "}
              <span className="text-primary">right channel</span>
            </>
          }
        />

        <div className="flex w-full max-w-[64rem] flex-col gap-10 px-4 sm:px-6 md:gap-12">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-[#1E1E1E14] bg-[linear-gradient(in_oklab_180deg,oklab(95.1%_0.011_-0.018_/_15%)_0%,oklab(93.7%_0.019_-0.031_/_75%)_100%)] p-2 sm:p-4 dark:border-white/10 dark:bg-white/[0.02] dark:bg-none">
            <div className="bg-background rounded-2xl border border-[#1E1E1E0D] p-4 sm:p-6 dark:border-white/5">
              <UtmBuilderTool />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>Every UTM parameter</h2>
            <p className={bodyClass}>
              Source, medium and campaign cover most links. The rest help when
              you run paid campaigns or import cost data into GA4.
            </p>
            <DataTable
              autoHeight
              columns={PARAMETER_COLUMNS}
              data={UTM_FIELDS}
              getRowId={(field) => field.key}
              rowSizing="content"
            />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>How GA4 picks a channel</h2>
            <p className={bodyClass}>
              GA4 runs these rules from top to bottom and stops at the first
              match. A link that matches none of them lands in Unassigned, where
              it is hard to report on. The builder runs the same rules on every
              link you make. {GA4_PAID_MEDIUM_NOTE}
            </p>
            <DataTable
              autoHeight
              columns={GA4_RULE_COLUMNS}
              data={GA4_CHANNEL_RULES}
              getRowId={(rule) => rule.channel}
              rowSizing="content"
            />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>Built for agents too</h2>
            <p className={bodyClass}>
              Every field lives in the page URL, so a filled-in builder is a
              link you can send to a teammate before anything goes live. Add{" "}
              <code className={codeClass}>.md</code> to the path and the same
              query returns the tagged links, the predicted channels and every
              warning as Markdown. No key, nothing stored.
            </p>
            <pre className="overflow-x-auto rounded-2xl border border-[#1E1E1E14] bg-[#FAFAFA] p-4 font-mono text-[0.8125rem]/6 text-[#1E1E1E] dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
              {`curl "${EXAMPLE_CALL}"`}
            </pre>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>
              Naming rules that keep reports clean
            </h2>
            <ul className={`${bodyClass} flex list-disc flex-col gap-2 pl-5`}>
              <li>
                Use lowercase everywhere. Email, email and EMAIL show up as
                three rows in GA4.
              </li>
              <li>
                Make the source the site or list and the medium the type of
                traffic: newsletter and email, not the other way round.
              </li>
              <li>
                Reuse one campaign name on every channel of a launch and tell
                links apart with utm_content.
              </li>
              <li>
                Never tag links between pages of your own site. It starts a new
                session and overwrites where the visitor really came from.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
