export async function seedSiteProject(organizationId: string): Promise<string> {
  const { db } = await import("@notra/db/drizzle");
  const { brandSettings, projects } = await import("@notra/db/schema");
  const id = `${organizationId}-project`;
  const brandSettingsId = `${id}-brand`;
  await db
    .insert(brandSettings)
    .values({
      id: brandSettingsId,
      organizationId,
      websiteUrl: "https://synthetic.example.test",
    })
    .onConflictDoNothing();
  await db
    .insert(projects)
    .values({
      id,
      organizationId,
      name: "Synthetic project",
      brandSettingsId,
    })
    .onConflictDoNothing();
  return id;
}
