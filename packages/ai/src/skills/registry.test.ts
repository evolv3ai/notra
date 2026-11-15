import { expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { spawnAsync } from "@notra/ai/utils/spawn-async";

if (process.env.NOTRA_SKILL_REGISTRY_TEST_WORKER !== "1") {
  test("system skill registry", async () => {
    const result = await spawnAsync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_SKILL_REGISTRY_TEST_WORKER: "1" },
        timeoutMs: 25_000,
      }
    );
    expect(result.status, result.stderr).toBe(0);
  }, 30_000);
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { and, eq } = await import("drizzle-orm");
  const schema = await import("@notra/db/schema");
  const { buildSystemSkills } = await import("./system-skills");

  const client = new PGlite();
  const db = drizzle(client, { schema });
  mock.module("@notra/db/drizzle", () => ({ db }));
  await client.exec(`
    create table organizations (id text primary key);
    create table users (id text primary key);
    create table system_skills (
      id text primary key,
      name text not null unique,
      description text not null,
      content text not null,
      version integer not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    );
    create table system_skill_versions (
      id text primary key,
      system_skill_id text not null references system_skills(id) on delete cascade,
      version integer not null,
      description text not null,
      content text not null,
      note text,
      published_by_user_id text references users(id) on delete set null,
      created_at timestamp not null default now(),
      unique (system_skill_id, version)
    );
    create table skills (
      id text primary key,
      organization_id text not null references organizations(id) on delete cascade,
      name text not null,
      description text not null,
      content text not null,
      is_system boolean not null default false,
      system_skill_id text references system_skills(id) on delete set null,
      system_skill_version integer,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      unique (organization_id, name)
    );
    insert into organizations (id) values ('untouched'), ('edited'), ('custom-name');
  `);

  const { skills, systemSkills } = schema;
  const { listSkillCatalog, loadSkillByName } =
    await import("./functions/service");
  const {
    ensureSystemSkillRegistry,
    listSkillUpstreamStatuses,
    publishSystemSkill,
    syncSkillToLatest,
  } = await import("./registry");
  const { seedSystemSkills } = await import("./seed");
  const blogPost = buildSystemSkills().find((s) => s.name === "blog-post");
  if (!blogPost) {
    throw new Error("blog-post definition missing");
  }

  const legacyDate = new Date("2025-01-01");
  await db.insert(skills).values([
    {
      id: "untouched-blog",
      organizationId: "untouched",
      name: "blog-post",
      description: "Old description",
      content: "old seeded prompt",
      isSystem: true,
      createdAt: legacyDate,
      updatedAt: legacyDate,
    },
    {
      id: "edited-blog",
      organizationId: "edited",
      name: "blog-post",
      description: "Old description",
      content: "Our own blog guidance",
      isSystem: true,
      createdAt: legacyDate,
      updatedAt: new Date("2025-02-01"),
    },
    {
      id: "custom-unslop",
      organizationId: "custom-name",
      name: "unslop",
      description: "Their own skill",
      content: "custom",
      isSystem: false,
    },
  ]);

  const copy = async (organizationId: string, name: string) =>
    db.query.skills.findFirst({
      where: and(
        eq(skills.organizationId, organizationId),
        eq(skills.name, name)
      ),
    });

  test("bootstrap adopts legacy rows and backfills missing skills", async () => {
    await ensureSystemSkillRegistry();

    const untouched = await copy("untouched", "blog-post");
    expect(untouched?.content).toBe(blogPost.content);
    expect(untouched?.systemSkillVersion).toBe(1);

    const edited = await copy("edited", "blog-post");
    expect(edited?.content).toBe("Our own blog guidance");
    expect(edited?.systemSkillVersion).toBe(1);

    expect((await copy("untouched", "unslop"))?.isSystem).toBe(true);
    expect((await copy("custom-name", "unslop"))?.content).toBe("custom");

    const statuses = await listSkillUpstreamStatuses("edited");
    expect(statuses.get("edited-blog")).toEqual({
      version: 1,
      latestVersion: 1,
      customized: true,
    });
    expect(statuses.get("untouched-blog")).toBeUndefined();
  });

  test("publishing updates uncustomized copies only", async () => {
    const result = await publishSystemSkill({
      name: "blog-post",
      description: blogPost.description,
      content: "v2 guidance",
      note: "Sharper intros",
      expectedVersion: 1,
    });
    expect(result.version).toBe(2);
    expect(result.updatedCopies).toBe(2);

    expect((await copy("untouched", "blog-post"))?.content).toBe("v2 guidance");
    expect((await copy("edited", "blog-post"))?.content).toBe(
      "Our own blog guidance"
    );
    expect(
      (await listSkillUpstreamStatuses("edited")).get("edited-blog")
    ).toEqual({ version: 1, latestVersion: 2, customized: true });
  });

  test("rejects a publish based on a stale version", async () => {
    await expect(
      publishSystemSkill({
        name: "blog-post",
        description: "x",
        content: "y",
        expectedVersion: 1,
      })
    ).rejects.toThrow("now at version 2");
  });

  test("keeping customizations marks the update as seen", async () => {
    const before = await copy("edited", "blog-post");
    const kept = await syncSkillToLatest("edited", "edited-blog", {
      keepCustomizations: true,
      reviewedVersion: 2,
      reviewedUpdatedAt: before?.updatedAt ?? new Date(),
    });
    expect(kept.status).toBe("synced");
    const afterKeep = await copy("edited", "blog-post");
    expect(afterKeep?.content).toBe("Our own blog guidance");
    expect(afterKeep?.systemSkillVersion).toBe(2);

    const applied = await syncSkillToLatest("edited", "edited-blog", {
      keepCustomizations: false,
      reviewedVersion: 2,
      reviewedUpdatedAt: afterKeep?.updatedAt ?? new Date(),
    });
    expect(applied.status === "synced" && applied.skill.content).toBe(
      "v2 guidance"
    );
    expect(
      (await listSkillUpstreamStatuses("edited")).get("edited-blog")?.customized
    ).toBe(false);
  });

  test("rejects syncing a version or revision the user did not review", async () => {
    const current = await copy("edited", "blog-post");
    expect(
      (
        await syncSkillToLatest("edited", "edited-blog", {
          keepCustomizations: false,
          reviewedVersion: 1,
          reviewedUpdatedAt: current?.updatedAt ?? new Date(),
        })
      ).status
    ).toBe("conflict");
    expect(
      (
        await syncSkillToLatest("edited", "edited-blog", {
          keepCustomizations: false,
          reviewedVersion: 2,
          reviewedUpdatedAt: new Date("2020-01-01"),
        })
      ).status
    ).toBe("conflict");
    expect(
      (
        await syncSkillToLatest("edited", "missing", {
          keepCustomizations: false,
          reviewedVersion: 2,
          reviewedUpdatedAt: new Date(),
        })
      ).status
    ).toBe("not_found");
  });

  test("a new system skill reaches every workspace", async () => {
    const result = await publishSystemSkill({
      name: "release-notes",
      description: "Release notes",
      content: "Write release notes",
      expectedVersion: null,
    });
    expect(result.addedCopies).toBe(3);

    await client.exec("insert into organizations (id) values ('fresh')");
    expect(await seedSystemSkills("fresh")).toBe(
      (await db.select().from(systemSkills)).length
    );
    expect((await copy("fresh", "blog-post"))?.content).toBe("v2 guidance");
  });

  test("agents read the organization copy, falling back to the registry", async () => {
    expect(
      (await loadSkillByName({ organizationId: "fresh" }, "unslop"))?.name
    ).toBe("unslop");
    expect(
      (await loadSkillByName({ organizationId: "custom-name" }, "unslop"))
        ?.content
    ).toBe("custom");
    await db.delete(skills).where(eq(skills.organizationId, "fresh"));
    expect(
      (await loadSkillByName({ organizationId: "fresh" }, "humanizer"))?.name
    ).toBe("humanizer");
    const catalog = await listSkillCatalog({ organizationId: "untouched" });
    expect(catalog.skills.some((skill) => skill.name === "release-notes")).toBe(
      true
    );
  });
}
