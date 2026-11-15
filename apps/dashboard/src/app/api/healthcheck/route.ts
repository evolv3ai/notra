import { isDemoMode } from "@notra/utils/demo-mode";

export async function GET(request: Request) {
  const body = {
    ok: true,
    time: new Date().toISOString(),
    commitSha:
      process.env.UNKEY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      null,
  };
  const headers = { "Cache-Control": "no-store" };
  // Probes stay cheap; the release asks the demo for a database check after
  // deploying it.
  if (!(isDemoMode() && new URL(request.url).searchParams.has("deep"))) {
    return Response.json(body, { headers });
  }
  const { checkDemoDatabaseSchema } = await import("@/lib/demo/schema-check");
  try {
    const tables = await checkDemoDatabaseSchema();
    return Response.json({ ...body, tables }, { headers });
  } catch (error) {
    return Response.json(
      {
        ...body,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503, headers }
    );
  }
}
