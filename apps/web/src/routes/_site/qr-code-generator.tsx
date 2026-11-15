import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { createFileRoute } from "@tanstack/react-router";

import { MarketingHeroWash } from "@/components/marketing-hero-wash";
import { QrCodeTool } from "@/components/qr-code/qr-code-tool";
import {
  QR_CODE_AGENT_PROMPT,
  QR_CODE_DESCRIPTION,
  QR_CODE_HERO_SUBTITLE,
  QR_CODE_SVG_URL,
  QR_CODE_TITLE,
  QR_CODE_URL,
} from "@/constants/qr-code";
import { UTM_BUILDER_PATH } from "@/constants/utm-builder";
import type { Metadata } from "@/types/metadata";
import { buildHead } from "@/utils/head";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import {
  DEFAULT_SOCIAL_IMAGE,
  pageAlternates,
  TWITTER_HANDLE,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const title = QR_CODE_TITLE;
const description = QR_CODE_DESCRIPTION;
const url = QR_CODE_URL;

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
  applicationCategory: "UtilitiesApplication",
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
const preClass =
  "overflow-x-auto rounded-2xl border border-[#1E1E1E14] bg-[#FAFAFA] p-4 font-mono text-[0.8125rem]/6 whitespace-pre-wrap text-[#1E1E1E] dark:border-white/10 dark:bg-white/[0.03] dark:text-white";

const EXAMPLE_CALL = `${QR_CODE_SVG_URL}?text=https%3A%2F%2Fexample.com&level=Q`;

export const Route = createFileRoute("/_site/qr-code-generator")({
  head: () => buildHead(metadata),
  component: QrCodePage,
});

function QrCodePage() {
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
          subtitle={QR_CODE_HERO_SUBTITLE}
          title={
            <>
              QR codes that point <span className="text-primary">straight</span>{" "}
              at your link
            </>
          }
        />

        <div className="flex w-full max-w-[64rem] flex-col gap-10 px-4 sm:px-6 md:gap-12">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-[#1E1E1E14] bg-[linear-gradient(in_oklab_180deg,oklab(95.1%_0.011_-0.018_/_15%)_0%,oklab(93.7%_0.019_-0.031_/_75%)_100%)] p-2 sm:p-4 dark:border-white/10 dark:bg-white/[0.02] dark:bg-none">
            <div className="bg-background rounded-2xl border border-[#1E1E1E0D] p-4 sm:p-6 dark:border-white/5">
              <QrCodeTool />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>Built for agents too</h2>
            <p className={bodyClass}>
              Every setting lives in the page URL. Call{" "}
              <code className={codeClass}>/api/qr-code</code> with the same
              query and you get the QR code back as an SVG. Add{" "}
              <code className={codeClass}>.md</code> to this page for the full
              reference as Markdown. No key, nothing stored.
            </p>
            <pre className={preClass}>{`curl "${EXAMPLE_CALL}"`}</pre>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-2">
                <h2 className={sectionTitleClass}>Prompt for your agent</h2>
                <p className={bodyClass}>
                  Paste this into your agent's instructions, AGENTS.md or
                  CLAUDE.md so it makes QR codes here instead of pulling in a
                  library.
                </p>
              </div>
              <CopyButton
                size="sm"
                value={QR_CODE_AGENT_PROMPT}
                variant="outline"
              >
                Copy prompt
              </CopyButton>
            </div>
            <pre className={preClass}>{QR_CODE_AGENT_PROMPT}</pre>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>Tips for codes that scan</h2>
            <ul className={`${bodyClass} flex list-disc flex-col gap-2 pl-5`}>
              <li>
                Keep dark modules on a light background with strong contrast.
                Many scanners give up on inverted or faint codes.
              </li>
              <li>
                Leave a margin of at least 2 modules, and 4 when the code sits
                on a busy background.
              </li>
              <li>
                Shorter text means bigger modules, which scan from further away.
              </li>
              <li>
                Tag marketing links with the{" "}
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={UTM_BUILDER_PATH}
                >
                  UTM builder
                </a>{" "}
                before you print them, so scans show up as their own source in
                analytics.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
