import type { OgBrandContext } from "@notra/ai/types/og-image";
import { fromHtml } from "hast-util-from-html";

/** Bounded public-page evidence, never executable website code. */
export function extractOgSiteEvidence(html: string, pageUrl: string) {
  const tree = fromHtml(html);
  const assets: OgBrandContext["assets"] = [];
  const stylesheets: string[] = [];
  const styles: string[] = [];
  let ogImage: string | null = null;
  const visit = (node: (typeof tree.children)[number]) => {
    if (node.type !== "element") {
      return;
    }
    const p = node.properties;
    if (typeof p.style === "string" && /background|mask|font/i.test(p.style)) {
      styles.push(p.style.slice(0, 1000));
    }
    if (
      node.tagName === "link" &&
      Array.isArray(p.rel) &&
      p.rel.includes("stylesheet") &&
      typeof p.href === "string" &&
      URL.canParse(p.href, pageUrl)
    ) {
      stylesheets.push(new URL(p.href, pageUrl).href);
    }
    if (
      node.tagName === "img" &&
      typeof p.src === "string" &&
      URL.canParse(p.src, pageUrl) &&
      !p.src.startsWith("data:")
    ) {
      const url = new URL(p.src, pageUrl);
      const label = `${p.alt ?? ""} ${url.pathname} ${url.searchParams.get("url") ?? ""}`;
      if (
        /logo|mark|hero|background|pattern|texture|illustration|artwork|cover/i.test(
          label
        ) &&
        !/customer|partner|competitor|testimonial|logocloud|integration|ai-engines|payment-methods/i.test(
          label
        )
      ) {
        // Resolve framework image proxies to the original, not a 32px thumbnail.
        const original = url.searchParams.get("url");
        if (original && !URL.canParse(original, pageUrl)) {
          return;
        }
        assets.push({
          id: `site-${assets.length}`,
          url: original ? new URL(original, pageUrl).href : url.href,
          label: label.slice(0, 180),
        });
      }
    }
    if (
      node.tagName === "meta" &&
      p.property === "og:image" &&
      typeof p.content === "string" &&
      URL.canParse(p.content, pageUrl)
    ) {
      ogImage = new URL(p.content, pageUrl).href;
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const child of tree.children) {
    visit(child);
  }
  return {
    assets,
    stylesheets: [...new Set(stylesheets)].slice(0, 4),
    ogImage: ogImage as string | null,
    styles: [...new Set(styles)].slice(0, 16).join("\n"),
  };
}
