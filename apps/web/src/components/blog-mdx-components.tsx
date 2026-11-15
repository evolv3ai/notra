import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ReactNode } from "react";

import {
  GitHubLogo,
  RailwayLogo,
  TinybirdLogo,
  WorkOSLogo,
} from "@/components/blog-diagrams/logos";
import {
  DemoApiFlowDiagram,
  DemoCookieDiagram,
  DemoDeploymentsDiagram,
  DemoPoolDiagram,
  DemoRebaseDiagram,
} from "@/components/blog-diagrams/notra-demo";
import {
  SitesConsentDemo,
  SitesDeployDiagram,
  SitesFreePlanCard,
  SitesReadersDemo,
} from "@/components/blog-diagrams/notra-sites";
import { MdxLink } from "@/components/mdx-link";
import { getMDXComponents } from "@/mdx-components";
import { getLogoLinkUrl } from "@/utils/outbound-link";

const BRAND_LOGOS = {
  GitHub: GitHubLogo,
  Railway: RailwayLogo,
  Tinybird: TinybirdLogo,
  WorkOS: WorkOSLogo,
} as const;

function Brand({
  name,
  children,
}: {
  name: keyof typeof BRAND_LOGOS;
  children?: ReactNode;
}) {
  const Logo = BRAND_LOGOS[name];
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <Logo className="size-[0.9em] translate-y-[0.1em]" />
      {children ?? name}
    </span>
  );
}

function BlogLink({ children, ...props }: ComponentProps<"a">) {
  const logoUrl = getLogoLinkUrl(props.href);
  return (
    <MdxLink {...props}>
      {logoUrl ? (
        <img
          alt=""
          aria-hidden
          className="not-prose mr-1 inline-block size-[0.95em] rounded-xs object-contain align-[-0.125em]"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={logoUrl}
        />
      ) : null}
      {children}
    </MdxLink>
  );
}

export function getBlogMDXComponents(): MDXComponents {
  const components = getMDXComponents({
    DemoApiFlowDiagram,
    DemoCookieDiagram,
    DemoDeploymentsDiagram,
    DemoPoolDiagram,
    DemoRebaseDiagram,
    SitesConsentDemo,
    SitesDeployDiagram,
    SitesFreePlanCard,
    SitesReadersDemo,
    Brand,
    pre: ({ children, ...props }) => (
      <div className="code-block">
        <button
          aria-label="Copy code"
          className="code-copy-button"
          data-copy-code
          type="button"
        >
          <HugeiconsIcon className="code-copy-icon" icon={Copy01Icon} />
          <HugeiconsIcon className="code-copy-icon-success" icon={Tick02Icon} />
        </button>
        <pre {...props}>{children}</pre>
      </div>
    ),
  });
  return { ...components, a: BlogLink };
}
