export const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export const YAML_KEY = /^(["']?)(.+?)\1\s*:(?:\s|$)/;

export const FRONTMATTER_EXAMPLES: Readonly<Record<string, string>> = {
  title: "title: Launch week recap",
  date: "date: 2026-11-01",
};
