import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { PGlite } from "@electric-sql/pglite";
import { contentAuthors, posts } from "@notra/db/schema";
import { patchPostRequestSchema } from "@notra/schemas/api/content";
import { drizzle } from "drizzle-orm/pglite";
import { Effect } from "effect";

import {
  commitPatchPost,
  getPost,
  listPosts,
  preparePatchPost,
} from "../src/programs/posts";
import { serializePost } from "../src/utils/posts";

const client = new PGlite();
const db = drizzle(client, { schema: { posts, contentAuthors } });
const ORG = "org_a";
const OTHER_ORG = "org_b";

function run<A, E>(program: Effect.Effect<A, E>) {
  return Effect.runPromise(Effect.result(program));
}

function patchBody(body: unknown) {
  return patchPostRequestSchema.parse(body);
}

beforeAll(async () => {
  await client.exec(`
    create table content_authors (
      id text primary key,
      organization_id text not null,
      slug text not null,
      name text not null,
      title text,
      bio text,
      avatar_url text,
      url text,
      x text,
      linkedin text,
      github text,
      user_id text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    );
    create table posts (
      id text primary key,
      organization_id text not null,
      title text not null,
      slug text,
      content text not null default '',
      html_url text,
      markdown text,
      recommendations text,
      content_type text not null,
      source_metadata jsonb,
      github_publish jsonb,
      cover_image jsonb,
      tags text[] not null default '{}',
      excerpt text,
      author_ids text[] not null default '{}',
      featured boolean not null default false,
      noindex boolean not null default false,
      hidden boolean not null default false,
      display_date timestamp,
      status text not null default 'published',
      published_at timestamp,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    );
    insert into content_authors (id, organization_id, slug, name, title) values
      ('auth_jane', '${ORG}', 'jane', 'Jane Doe', 'Head of Product'),
      ('auth_max', '${ORG}', 'max', 'Max Mustermann', null),
      ('auth_foreign', '${OTHER_ORG}', 'eve', 'Eve', null);
    insert into posts (id, organization_id, title, content_type, author_ids, tags, cover_image, display_date, created_at) values
      ('post_blog', '${ORG}', 'Blog', 'blog_post', '{auth_max,auth_deleted,auth_jane}', '{editor}',
        '{"url":"https://cdn.example.com/c.png","alt":"Cover"}', '2026-10-01 00:00:00', '2026-10-03'),
      ('post_social', '${ORG}', 'Social', 'linkedin_post', '{auth_jane}', '{}', null, null, '2026-10-02');
  `);
});

afterAll(async () => {
  await client.close();
});

describe("post metadata responses", () => {
  test("resolves authors in stored order and hides metadata for social posts", async () => {
    const result = await run(
      listPosts({
        db: db as never,
        organizationId: ORG,
        query: {
          sort: "desc",
          limit: 10,
          page: 1,
          status: ["published"],
          contentType: ["blog_post", "linkedin_post"],
          brandIdentityId: [],
        },
      })
    );
    if (result._tag === "Failure") {
      throw new Error(String(result.failure));
    }

    const [blog, social] = result.success.posts.map((post) =>
      serializePost(post, result.success.authors)
    );

    expect(blog?.metadata).toEqual({
      coverImage: { url: "https://cdn.example.com/c.png", alt: "Cover" },
      tags: ["editor"],
      excerpt: null,
      authors: [
        {
          id: "auth_max",
          slug: "max",
          name: "Max Mustermann",
          title: null,
          avatarUrl: null,
        },
        {
          id: "auth_jane",
          slug: "jane",
          name: "Jane Doe",
          title: "Head of Product",
          avatarUrl: null,
        },
      ],
      featured: false,
      noindex: false,
      hidden: false,
      displayDate: "2026-10-01",
    });
    expect(social?.metadata).toBeNull();
  });
});

describe("PATCH metadata", () => {
  test("rejects metadata for content types without site metadata", async () => {
    const result = await run(
      preparePatchPost({
        db: db as never,
        organizationId: ORG,
        postId: "post_social",
        body: patchBody({ metadata: { featured: true } }),
      })
    );

    expect(result._tag === "Failure" && result.failure._tag).toBe(
      "PostMetadataNotSupportedError"
    );
  });

  test("rejects author IDs from another organization", async () => {
    const result = await run(
      preparePatchPost({
        db: db as never,
        organizationId: ORG,
        postId: "post_blog",
        body: patchBody({
          metadata: { authorIds: ["auth_jane", "auth_foreign"] },
        }),
      })
    );

    expect(result._tag === "Failure" && result.failure._tag).toBe(
      "PostUnknownAuthorError"
    );
  });

  test("rejects an empty metadata object", () => {
    expect(
      patchPostRequestSchema.safeParse({ metadata: {} }).success
    ).toBeFalse();
  });

  test("writes only the sent fields and returns the resolved metadata", async () => {
    const prepared = await run(
      preparePatchPost({
        db: db as never,
        organizationId: ORG,
        postId: "post_blog",
        body: patchBody({
          metadata: {
            authorIds: ["auth_jane", "auth_jane"],
            tags: ["Launch", "launch", " beta "],
            excerpt: "",
            displayDate: "2026-09-15",
            featured: true,
          },
        }),
      })
    );
    if (prepared._tag === "Failure") {
      throw new Error(String(prepared.failure));
    }

    const committed = await run(
      commitPatchPost({
        db: db as never,
        organizationId: ORG,
        postId: "post_blog",
        prepared: prepared.success.prepared,
      })
    );
    if (committed._tag === "Failure") {
      throw new Error(String(committed.failure));
    }

    const metadata = serializePost(
      committed.success.post,
      committed.success.authors
    ).metadata;
    expect(metadata).toMatchObject({
      coverImage: { url: "https://cdn.example.com/c.png", alt: "Cover" },
      tags: ["Launch", "beta"],
      excerpt: null,
      authors: [{ id: "auth_jane", name: "Jane Doe" }],
      featured: true,
      noindex: false,
      hidden: false,
      displayDate: "2026-09-15",
    });

    const fetched = await run(
      getPost({ db: db as never, organizationId: ORG, postId: "post_blog" })
    );
    expect(
      fetched._tag === "Success" &&
        fetched.success.post &&
        serializePost(fetched.success.post, fetched.success.authors).metadata
    ).toEqual(metadata);
  });
});
