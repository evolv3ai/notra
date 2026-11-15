import { NextResponse } from "next/server";

import {
  CONTEXT_COMPETITORS_COUNT,
  CONTEXT_COMPETITORS_URL,
} from "@/constants/geo-report";
import { hasAdminRole } from "@/lib/auth/role";
import { getServerSession } from "@/lib/auth/session";
import { fetchSiteText } from "@/lib/geo-reports/site-text";
import { contextCompanyResponseSchema } from "@/schemas/geo-report";
import type { GeoCompanyLookup } from "@/types/geo-report";

const MIN_DOMAIN_LENGTH = 3;

/** Company profile from context.dev plus the homepage text used to fact-check claims. */
export async function GET(request: Request) {
  const { user } = await getServerSession();
  if (!(user && hasAdminRole(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const domain = new URL(request.url).searchParams
    .get("domain")
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (!domain || domain.length < MIN_DOMAIN_LENGTH) {
    return NextResponse.json({ error: "Enter a domain" }, { status: 400 });
  }
  const apiKey = process.env.CONTEXT_DEV_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CONTEXT_DEV_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const url = new URL(CONTEXT_COMPETITORS_URL);
  url.searchParams.set("domain", domain);
  url.searchParams.set("numCompetitors", String(CONTEXT_COMPETITORS_COUNT));
  const [contextResponse, siteText] = await Promise.all([
    fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } }),
    fetchSiteText(domain),
  ]);
  if (!contextResponse.ok) {
    return NextResponse.json(
      { error: `context.dev returned ${contextResponse.status}` },
      { status: 502 }
    );
  }
  const parsed = contextCompanyResponseSchema.safeParse(
    await contextResponse.json()
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Unexpected response from context.dev" },
      { status: 502 }
    );
  }

  const lookup: GeoCompanyLookup = {
    name: parsed.data.target?.companyName ?? domain,
    category: parsed.data.target?.field ?? "",
    summary:
      parsed.data.target?.fieldDescription ?? parsed.data.target?.field ?? "",
    siteText,
    competitors: parsed.data.competitors.map((competitor) => ({
      name: competitor.name,
      domain: competitor.domain,
      description: competitor.description,
      confidence: competitor.confidence,
    })),
  };
  return NextResponse.json(lookup);
}
