import { expect, test } from "bun:test";

import {
  buildSiteEntryMarkdown,
  extractMarkdownExcerpt,
  parseSiteConfigAuthors,
  readSiteEntryAuthor,
  resolveSiteAuthor,
  resolveSiteImagePathTemplate,
} from "./site-github-publish";

const DATE = new Date("2026-10-05T21:30:00.000Z");

test("adds frontmatter and drops the duplicate title heading", () => {
  const markdown = buildSiteEntryMarkdown({
    author: "jan",
    contentType: "blog_post",
    date: DATE,
    markdown: [
      '# Shipping "Sites"',
      "",
      "![Cover](/images/blog/shipping-sites/image-abc.png)",
      "",
      "We **now** host your [blog](https://example.com) and `changelog`.",
      "",
      "## Details",
    ].join("\n"),
    title: 'Shipping "Sites"',
  });
  expect(markdown).toBe(
    [
      "---",
      'title: "Shipping \\"Sites\\""',
      'description: "We now host your blog and changelog."',
      "date: 2026-10-05",
      'author: "jan"',
      'image: "/images/blog/shipping-sites/image-abc.png"',
      "---",
      "",
      "![Cover](/images/blog/shipping-sites/image-abc.png)",
      "",
      "We **now** host your [blog](https://example.com) and `changelog`.",
      "",
      "## Details",
    ].join("\n")
  );
});

test("changelogs get no author and relative images are skipped", () => {
  const markdown = buildSiteEntryMarkdown({
    author: "jan",
    contentType: "changelog",
    date: DATE,
    markdown: "![Shot](./shot.png)\n\nFixed things.",
    title: "v1.2",
  });
  expect(markdown).toBe(
    '---\ntitle: "v1.2"\ndescription: "Fixed things."\ndate: 2026-10-05\n---\n\n![Shot](./shot.png)\n\nFixed things.'
  );
});

test("keeps existing frontmatter and only fills in title and date", () => {
  const complete = "---\ntitle: Hi\ndate: 2024-01-01\n---\n# Hi\n";
  expect(
    buildSiteEntryMarkdown({
      contentType: "blog_post",
      date: DATE,
      markdown: complete,
      title: "Hi",
    })
  ).toBe(complete);
  expect(
    buildSiteEntryMarkdown({
      contentType: "blog_post",
      date: DATE,
      markdown: "---\ntags: [a]\n---\nBody",
      title: "Hi",
    })
  ).toBe('---\ntags: [ a ]\ntitle: "Hi"\ndate: 2026-10-05\n---\nBody');
});

test("excerpts stay under the limit on a word boundary", () => {
  const excerpt = extractMarkdownExcerpt(
    `## Heading\n\n${"word ".repeat(60)}`,
    40
  );
  expect(excerpt.length).toBeLessThanOrEqual(40);
  expect(excerpt).toBe("word word word word word word word word…");
});

test("matches blog.json authors by name", () => {
  const authors = parseSiteConfigAuthors(
    JSON.stringify({ name: "Acme", authors: { jan: { name: "Jan B" } } })
  );
  expect(resolveSiteAuthor(authors, "jan b")).toBe("jan");
  expect(resolveSiteAuthor(authors, "Dominik")).toBe("Dominik");
  expect(resolveSiteAuthor(authors, " ")).toBeNull();
  expect(parseSiteConfigAuthors("{not json")).toEqual({});
});

test("reads a single author back from an entry", () => {
  expect(readSiteEntryAuthor('---\ntitle: "A"\nauthor: "jan"\n---\n')).toBe(
    "jan"
  );
  expect(readSiteEntryAuthor("---\nauthor: jan # me\n---\n")).toBe("jan");
  expect(readSiteEntryAuthor("---\nauthor: [a, b]\n---\n")).toBeNull();
  expect(readSiteEntryAuthor("author: jan")).toBeNull();
});

test("site images live under the root's public folder", () => {
  expect(resolveSiteImagePathTemplate("docs", "blog_post")).toBe(
    "docs/public/images/blog/:slug/image"
  );
  expect(resolveSiteImagePathTemplate("", "changelog")).toBe(
    "public/images/changelog/:slug/image"
  );
});

const EXISTING = [
  "---",
  'title: "Old title"',
  "date: 2026-09-01",
  "tags: [Legacy]",
  "# hand-written",
  "noindex: true",
  "canonical: https://example.com/elsewhere",
  "---",
  "",
  "Old body.",
].join("\n");

test("writes Notra metadata over the repo file and keeps foreign keys", () => {
  const markdown = buildSiteEntryMarkdown({
    contentType: "blog_post",
    date: DATE,
    existingMarkdown: EXISTING,
    markdown: "Fresh body with **news**.",
    metadata: {
      authors: [
        {
          id: "jan",
          name: "Jan",
          title: "Engineering",
          avatar: "/images/blog/post/image-author-jan-a.png",
        },
      ],
      description: null,
      featured: true,
      image: { src: "/images/blog/post/image-cover-b.png", alt: "Diagram" },
      noindex: false,
      tags: ["Product", "GEO"],
    },
    title: "New title",
    updated: new Date("2026-10-12T08:00:00.000Z"),
  });
  expect(markdown).toBe(
    [
      "---",
      'title: "New title"',
      "date: 2026-10-05",
      "tags:",
      '  - "Product"',
      '  - "GEO"',
      "canonical: https://example.com/elsewhere",
      'description: "Fresh body with news."',
      "updated: 2026-10-12",
      "author:",
      '  id: "jan"',
      '  name: "Jan"',
      '  title: "Engineering"',
      '  avatar: "/images/blog/post/image-author-jan-a.png"',
      'image: "/images/blog/post/image-cover-b.png"',
      'imageAlt: "Diagram"',
      "featured: true",
      "---",
      "",
      "Fresh body with **news**.",
    ].join("\n")
  );
});

test("fields cleared in Notra are removed, derived ones follow the body", () => {
  const previous = buildSiteEntryMarkdown({
    contentType: "blog_post",
    date: DATE,
    markdown: "![Old](/images/blog/t/old.png)\n\nOld intro.",
    metadata: {
      authors: [{ id: "jan", name: "Jan" }],
      date: new Date("2026-08-15T00:00:00.000Z"),
      featured: true,
      image: { src: "/images/blog/t/cover.png", alt: "Cover" },
      noindex: true,
      tags: ["editor"],
    },
    title: "T",
  });
  const markdown = buildSiteEntryMarkdown({
    author: "publisher",
    contentType: "blog_post",
    date: DATE,
    existingMarkdown: previous.replace("---\n\n", "canonical: x\n---\n\n"),
    markdown: "New intro without images.",
    metadata: {
      authors: [],
      date: null,
      description: null,
      featured: false,
      image: null,
      noindex: false,
      tags: [],
    },
    title: "T",
  });
  expect(markdown).toBe(
    [
      "---",
      'title: "T"',
      'description: "New intro without images."',
      "date: 2026-10-05",
      'author: "publisher"',
      "canonical: x",
      "---",
      "",
      "New intro without images.",
    ].join("\n")
  );
});

test("a date chosen in Notra wins and several authors become a list", () => {
  const markdown = buildSiteEntryMarkdown({
    contentType: "blog_post",
    date: DATE,
    markdown: "Body",
    metadata: {
      authors: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      date: new Date("2026-08-15T00:00:00.000Z"),
    },
    title: "T",
  });
  expect(markdown).toContain("date: 2026-08-15");
  expect(markdown).toContain(
    'author:\n  - id: "a"\n    name: "A"\n  - id: "b"'
  );
});

test("changelogs never get authors or featured", () => {
  const markdown = buildSiteEntryMarkdown({
    contentType: "changelog",
    date: DATE,
    markdown: "Body",
    metadata: {
      authors: [{ id: "a", name: "A" }],
      featured: true,
      tags: ["Release"],
    },
    title: "v2",
  });
  expect(markdown).not.toContain("author");
  expect(markdown).not.toContain("featured");
  expect(markdown).toContain('tags:\n  - "Release"');
});

test("titles that look like YAML booleans stay strings", () => {
  const markdown = buildSiteEntryMarkdown({
    contentType: "blog_post",
    date: DATE,
    markdown: "Body",
    title: "No",
  });
  expect(markdown).toContain('title: "No"');
});
