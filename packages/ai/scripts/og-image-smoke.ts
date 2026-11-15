import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

import { brandSettings, brandOgTemplates } from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { OG_PROBE_TITLES } from "../src/constants/og-image";
import { OG_SMOKE_BRANDS } from "../src/constants/og-image-smoke";
import { ogImageResultSchema } from "../src/schemas/og-image";
import type { AgentTokenUsage } from "../src/types/agents";
import { toAgentTokenUsage } from "../src/utils/token-usage";
import { createOgTestDatabase } from "./utils/og-test-database";
import { createOgTestStorage } from "./utils/og-test-storage";

// Explicit opt-in. Never load the source .env's database, billing or storage credentials.
const envFile = process.argv[2];
const outputDirectory = process.argv[3];
assert.ok(
  envFile && outputDirectory,
  "Usage: bun scripts/og-image-smoke.ts /path/to/dev.env /output/directory [domain ...]"
);
const environment = parseEnv(await readFile(resolve(envFile), "utf8"));
for (const name of [
  "AI_GATEWAY_API_KEY",
  "OPENROUTER_API_KEY",
  "CONTEXT_DEV_API_KEY",
]) {
  if (environment[name]) {
    process.env[name] = environment[name];
  }
}
delete process.env.AUTUMN_SECRET_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.DATABASE_URL;
process.env.NODE_ENV = "development";
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const sourceFiles = [
  "agents/og-image.ts",
  "utils/og-research.ts",
  "prompts/og-image.ts",
  "constants/og-image.ts",
];
await writeFile(
  join(output, "source-manifest.json"),
  JSON.stringify(
    Object.fromEntries(
      await Promise.all(
        sourceFiles.map(async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(new URL(`../src/${file}`, import.meta.url)))
            .digest("hex"),
        ])
      )
    ),
    null,
    2
  )
);
const { client, db, organizationId } = await createOgTestDatabase();
mock.module("@notra/db/drizzle", () => ({ db }));
const storage = await createOgTestStorage();
const { researchOgBrand: researchActualOgBrand } =
  await import("../src/utils/og-research");
let researchMs = 0;
let activeDomain = "";
mock.module("@notra/ai/utils/og-research", () => ({
  researchOgBrand: async (
    ...args: Parameters<typeof researchActualOgBrand>
  ) => {
    const started = performance.now();
    const result = await researchActualOgBrand(...args);
    researchMs += Math.round(performance.now() - started);
    await writeFile(
      join(output, `${activeDomain}-research.json`),
      JSON.stringify(result, null, 2)
    );
    return result;
  },
}));
// Preserve exact pre-review probes for diagnosing visual-review failures.
const { renderOgImage: renderActualOgImage, validateOgLayout } =
  await import("../src/utils/og-render");
let renderIndex = 0;
mock.module("@notra/ai/utils/og-render", () => ({
  validateOgLayout,
  renderOgImage: async (...args: Parameters<typeof renderActualOgImage>) => {
    const result = await renderActualOgImage(...args);
    await writeFile(
      join(output, `probe-${renderIndex++}.png`),
      Buffer.from(result.pngBase64, "base64")
    );
    return result;
  },
}));
const { ToolLoopAgent, isStepCount } = await import("ai");
const { gateway } = await import("../src/gateway");
const { AGENT_DEFAULT_MODEL } = await import("../src/constants/models");
const { createGenerateOgImageTool } = await import("../src/tools/og-image");
const renderPostHeroImage = (
  await import(
    new URL(
      "../../../apps/dashboard/src/lib/autopilot/hero-image.ts",
      import.meta.url
    ).href
  )
)
  .renderPostHeroImage as typeof import("../src/utils/og-image").generateBrandOgImage;
const reports = [];
const selected = new Set(process.argv.slice(4));
try {
  for (const brand of OG_SMOKE_BRANDS.filter(
    (item) => selected.size === 0 || selected.has(item.domain)
  )) {
    activeDomain = brand.domain;
    researchMs = 0;
    const brandIdentityId = crypto.randomUUID();
    await db.insert(brandSettings).values({
      id: brandIdentityId,
      organizationId,
      name: brand.name,
      companyName: brand.name,
      websiteUrl: `https://${brand.domain}`,
      isDefault: false,
    });
    let designCalls = 0;
    const designUsage: AgentTokenUsage[] = [];
    const agent = new ToolLoopAgent({
      model: gateway(AGENT_DEFAULT_MODEL, { organizationId }),
      instructions:
        "Call generateOgImage exactly once for the requested brand and title. Do not ask questions. After the tool result, return its URL and warnings without inventing a result.",
      tools: {
        generateOgImage: createGenerateOgImageTool({
          organizationId,
          brandIdentityId,
          onUsage: (usage) => {
            designCalls += 1;
            designUsage.push(usage);
          },
        }),
      },
      stopWhen: isStepCount(2),
      prepareStep: ({ stepNumber }) =>
        stepNumber > 0 ? { activeTools: [] } : undefined,
    });
    const started = performance.now();
    const result = await agent.generate({
      prompt: `Generate an OG image for ${brand.name}. Exact title: ${OG_PROBE_TITLES[0]}`,
    });
    const toolResult = result.steps
      .flatMap((step) => step.toolResults)
      .find((item) => item.toolName === "generateOgImage");
    assert.ok(
      toolResult,
      `The real agent must call the registered tool: ${JSON.stringify(result.steps.map((step) => ({ calls: step.toolCalls, results: step.toolResults, content: step.content })))}`
    );
    const first = ogImageResultSchema.parse(toolResult.output);
    const response = await fetch(first.imageUrl);
    if (!response.ok) {
      throw new Error(`Uploaded image returned HTTP ${response.status}`);
    }
    assert.equal(
      response.status,
      200,
      "The actual S3 upload must produce a readable image URL"
    );
    assert.equal(response.headers.get("content-type"), "image/png");
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    await writeFile(join(output, `${brand.domain}.png`), png);
    const generatedMs = Math.round(performance.now() - started);
    const callsBeforeCache = designCalls;
    const cacheStarted = performance.now();
    const cached = await renderPostHeroImage({
      organizationId,
      brandIdentityId,
      title: OG_PROBE_TITLES[1],
      onUsage: (usage) => {
        designCalls += 1;
        designUsage.push(usage);
      },
    });
    await writeFile(
      join(output, `${brand.domain}-autopilot.png`),
      Buffer.from(cached.pngBase64, "base64")
    );
    const cachedMs = Math.round(performance.now() - cacheStarted);
    const saved = await db.query.brandOgTemplates.findFirst({
      where: eq(brandOgTemplates.brandSettingsId, brandIdentityId),
    });
    if (saved) {
      await writeFile(
        join(output, `${brand.domain}-template.json`),
        JSON.stringify(saved.document)
      );
    }
    const passed =
      first.templateSource === "generated" &&
      cached.templateSource === "cached" &&
      callsBeforeCache === designCalls;
    reports.push({
      brand: brand.domain,
      agentCalledTool: true,
      s3UploadRoundTrip: true,
      source: first.templateSource,
      autopilotSource: cached.templateSource,
      designCalls,
      generatedMs,
      cachedMs,
      researchMs,
      designUsage,
      agentUsage: toAgentTokenUsage(result.totalUsage),
      warnings: first.warnings,
      passed,
    });
    console.log(JSON.stringify(reports.at(-1)));
  }
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(reports, null, 2)
  );
  const cards = await Promise.all(
    reports.map(
      async (report) =>
        `<section><h2>${report.brand}</h2><p>Agent: ${report.source} · Autopilot: ${report.autopilotSource}</p><img width="1200" height="630" alt="Autonomer OG-Entwurf für ${report.brand}" src="data:image/png;base64,${(await readFile(join(output, `${report.brand}.png`))).toString("base64")}"><details><summary>Langer Titel über Autopilot</summary><img width="1200" height="630" alt="Autopilot mit langem Titel" src="data:image/png;base64,${(await readFile(join(output, `${report.brand}-autopilot.png`))).toString("base64")}"></details></section>`
    )
  );
  await writeFile(
    join(output, "preview.html"),
    `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autonome OG-Pipeline</title><style>body{margin:32px auto;max-width:1200px;padding:0 20px;background:#f7f7f7;color:#222;font:16px system-ui}h1,h2{font-weight:500}img{display:block;width:100%;height:auto;outline:1px solid #0001}section{margin:40px 0}details{margin-top:16px}summary{cursor:pointer;padding:12px 0}summary:focus-visible{outline:2px solid #2563eb}</style><h1>Autonome Pipeline · Agent-Tool → Brand-Recherche → gespeichertes Template → Autopilot</h1><p>Echte Provider-Aufrufe, isolierte lokale Datenbank mit allen committed Migrations. Nur der Upload wird lokal gespeichert statt nach R2 geschrieben. Kein pro Brand vorgeschriebenes Layout.</p>${cards.join("")}</html>`
  );
  assert.ok(
    reports.length > 0 && reports.every((report) => report.passed),
    "All brands must generate and reuse a real template, not silently pass via fallback"
  );
} finally {
  storage.closeAllConnections();
  storage.close();
  await client.close();
}
