import { gateway, generateText, Output } from "ai";
import { NextResponse } from "next/server";

import { GEO_SCAN_JUDGE_MODEL_ID } from "@/constants/geo-report";
import { requireGeoAutomation } from "@/lib/geo-reports/gateway-auth";
import {
  geoRecommendOutputSchema,
  geoRecommendRequestSchema,
} from "@/schemas/geo-report";

export const maxDuration = 60;

/** One concrete piece of content per shelf-space gap. */
export async function POST(request: Request) {
  const denied = await requireGeoAutomation();
  if (denied) {
    return denied;
  }
  const parsed = geoRecommendRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { company, gaps } = parsed.data;
  if (gaps.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const result = await generateText({
      model: gateway(GEO_SCAN_JUDGE_MODEL_ID),
      output: Output.object({ schema: geoRecommendOutputSchema }),
      system:
        "You advise developer-tool companies on Generative Engine Optimization. For each gap, name the single most effective piece of content that would get the company into that answer, and the channel it belongs on. Be concrete: name the page, guide, thread or video. One or two sentences each. Return one item per gap id.",
      prompt: `Company: ${company.name} (${company.domain}), ${company.category || "unknown category"}\n\n${gaps
        .map(
          (gap) =>
            `id: ${gap.id}\nPrompt: ${gap.prompt}\nHeld by: ${gap.heldBy.join(", ") || "unknown"}\nWhy missing: ${gap.gap}`
        )
        .join("\n\n")}`,
    });
    const requestedIds = new Set(gaps.map((gap) => gap.id));
    const returnedIds = new Set(result.output.items.map((item) => item.id));
    if (
      result.output.items.length !== gaps.length ||
      returnedIds.size !== requestedIds.size ||
      [...returnedIds].some((id) => !requestedIds.has(id))
    ) {
      throw new Error("Recommendations did not match the requested gaps");
    }
    return NextResponse.json({ items: result.output.items });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate recommendations",
      },
      { status: 502 }
    );
  }
}
