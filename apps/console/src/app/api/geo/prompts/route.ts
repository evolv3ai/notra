import { gateway, generateText, Output } from "ai";
import { NextResponse } from "next/server";

import { GEO_SCAN_JUDGE_MODEL_ID } from "@/constants/geo-report";
import { requireGeoAutomation } from "@/lib/geo-reports/gateway-auth";
import {
  geoPromptsOutputSchema,
  geoPromptsRequestSchema,
} from "@/schemas/geo-report";

export const maxDuration = 60;

/** Proposes the buying questions a prospect's customers ask AI assistants. */
export async function POST(request: Request) {
  const denied = await requireGeoAutomation();
  if (denied) {
    return denied;
  }
  const parsed = geoPromptsRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { company, competitors, count } = parsed.data;

  try {
    const result = await generateText({
      model: gateway(GEO_SCAN_JUDGE_MODEL_ID),
      output: Output.object({ schema: geoPromptsOutputSchema }),
      system:
        "You design prompt sets for Generative Engine Optimization audits. Write the questions real buyers type into ChatGPT, Claude or Gemini when choosing a product in this category. Mix intents: best-of lists, comparisons with named competitors, alternatives to a competitor, how-to questions that imply a tool choice, pricing questions, and one or two that name the company directly. Keep each under 15 words. Do not number them.",
      prompt: `Company: ${company.name} (${company.domain})\nCategory: ${company.category || "unknown"}\nCompetitors: ${competitors.join(", ") || "unknown"}\nWrite ${count} prompts.`,
    });
    return NextResponse.json({
      prompts: result.output.prompts.slice(0, count),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not generate prompts",
      },
      { status: 502 }
    );
  }
}
