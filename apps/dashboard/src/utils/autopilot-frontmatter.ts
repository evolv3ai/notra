import { AUTOPILOT_IMAGE_FRONTMATTER_KEYS } from "@/constants/autopilot";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const KEY_LINE = /^([A-Za-z][\w-]*)\s*:/;

function frontmatterKeys(content: string | null) {
  const block = content?.match(FRONTMATTER)?.[1];
  if (!block) {
    return null;
  }
  return new Set(
    block.split(/\r?\n/).flatMap((line) => {
      const key = line.match(KEY_LINE)?.[1];
      return key ? [key] : [];
    })
  );
}

/**
 * Which frontmatter fields to use for the hero image: the one the repo's
 * sample post already uses, else image + imageAlt (what Notra Sites reads).
 */
export function imageFrontmatterFields(sample: string | null) {
  const keys = frontmatterKeys(sample);
  if (!keys) {
    return { image: "image", alt: "imageAlt" };
  }
  const image =
    AUTOPILOT_IMAGE_FRONTMATTER_KEYS.find((key) => keys.has(key)) ?? "image";
  const alt = [`${image}Alt`, "imageAlt", "coverAlt", "alt"].find((key) =>
    keys.has(key)
  );
  // Without a sample field, a strict content schema may reject extra keys.
  return { image, alt: alt ?? (keys.has(image) ? null : "imageAlt") };
}

/** Sets top-level frontmatter fields, replacing any value already there. */
export function setFrontmatterFields(
  content: string,
  fields: Record<string, string>
) {
  const match = content.match(FRONTMATTER);
  if (!match) {
    return content;
  }
  const names = new Set(Object.keys(fields));
  const kept = (match[1] ?? "")
    .split(/\r?\n/)
    .filter((line) => !names.has(line.match(KEY_LINE)?.[1] ?? ""));
  const added = Object.entries(fields).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`
  );
  return `---\n${[...kept, ...added].join("\n")}\n---\n${content.slice(match[0].length)}`;
}

/**
 * Where the hero image goes: under the nearest public/ folder above the blog
 * directory (served from the site root by Next.js, Astro and Notra Sites),
 * else next to the post.
 */
export function heroImageLocation(
  paths: string[],
  directory: string,
  slug: string
) {
  const segments = directory.split("/");
  for (let depth = segments.length - 1; depth >= 0; depth -= 1) {
    const base = segments.slice(0, depth).join("/");
    const prefix = base ? `${base}/` : "";
    if (paths.some((path) => path.startsWith(`${prefix}public/`))) {
      return {
        path: `${prefix}public/images/blog/${slug}.png`,
        url: `/images/blog/${slug}.png`,
      };
    }
  }
  return { path: `${directory}/${slug}.png`, url: `./${slug}.png` };
}
