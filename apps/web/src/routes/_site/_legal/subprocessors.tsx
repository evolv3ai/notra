import { createFileRoute } from "@tanstack/react-router";

import SubprocessorsContent from "@/content/legal/subprocessors.mdx";
import type { Metadata } from "@/types/metadata";
import { buildHead } from "@/utils/head";
import {
  DEFAULT_SOCIAL_IMAGE,
  TWITTER_HANDLE,
  pageAlternates,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const title = "Sub-processors";
const description =
  "The third parties Notra uses to process personal data on behalf of its customers.";
const url = `${SITE_URL}/subprocessors`;

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

export const Route = createFileRoute("/_site/_legal/subprocessors")({
  head: () => buildHead(metadata),
  component: SubprocessorsPage,
});

function SubprocessorsPage() {
  return (
    <>
      <header className="not-prose mb-10 border-b border-[#1E1E1E1A] pb-8 dark:border-white/10">
        <h1 className="font-display text-4xl leading-[1.1] font-medium tracking-[-0.02em] text-[#1E1E1E] sm:text-5xl dark:text-white">
          Our <span className="text-primary">Sub-processors</span>
        </h1>
        <p className="mt-4 font-sans text-base leading-7 text-[#1E1E1EBF] dark:text-white/70">
          The third parties that process personal data on our behalf.
        </p>
      </header>
      <SubprocessorsContent />
    </>
  );
}
