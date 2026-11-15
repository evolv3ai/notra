import {
  ArrowDown01Icon,
  LeftToRightListBulletIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import type { BlogPostTocProps } from "~types/blog";

import { TOC_DEPTHS } from "@/lib/blog/constants";
import { buildTocSections } from "@/lib/blog/toc";

export function BlogPostMobileToc({ toc }: BlogPostTocProps) {
  const sections = buildTocSections(
    toc.filter((item) => (TOC_DEPTHS as readonly number[]).includes(item.depth))
  );

  if (sections.length === 0) {
    return null;
  }

  const sectionLabel = sections.length === 1 ? "section" : "sections";

  return (
    <Collapsible
      className="not-prose border-border mb-6 rounded-xl border p-2 lg:hidden"
      defaultOpen={false}
    >
      <CollapsibleTrigger className="hover:bg-muted/60 flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors">
        <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
          <HugeiconsIcon className="size-5" icon={LeftToRightListBulletIcon} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-foreground font-sans text-sm font-medium">
            On this page
          </span>
          <span className="text-muted-foreground font-sans text-xs">
            {sections.length} {sectionLabel}
          </span>
        </span>
        <HugeiconsIcon
          className="text-muted-foreground size-4 transition-transform [[data-panel-open]_&]:rotate-180"
          icon={ArrowDown01Icon}
          strokeWidth={2}
        />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>
        <nav
          aria-label="On this page"
          className="border-border mt-2 border-t pt-2"
        >
          <ol className="flex flex-col">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  className="hover:bg-muted/60 flex items-center gap-3 rounded-lg p-2 transition-colors"
                  href={section.url}
                >
                  <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-foreground font-sans text-sm font-medium">
                    {section.title}
                  </span>
                </a>
                {section.children.length > 0 ? (
                  <ol className="border-border mb-1 ml-6.5 flex flex-col border-l pl-5">
                    {section.children.map((child) => (
                      <li key={child.id}>
                        <a
                          className="text-muted-foreground hover:text-foreground block py-1.5 font-sans text-sm transition-colors"
                          href={child.url}
                        >
                          {child.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}
