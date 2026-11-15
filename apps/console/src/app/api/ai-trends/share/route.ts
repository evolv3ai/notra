import { NextResponse } from "next/server";

import { renderShareCard } from "@/lib/ai-trends/share-card";
import { hasAdminRole } from "@/lib/auth/role";
import { getServerSession } from "@/lib/auth/session";
import { aiTrendsShareCardSchema } from "@/schemas/ai-trends";

/** PNG of one trends chart in the share-card layout, drawn from the posted data. */
export async function POST(request: Request) {
  const { user } = await getServerSession();
  if (!(user && hasAdminRole(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = aiTrendsShareCardSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card" }, { status: 400 });
  }
  return renderShareCard(parsed.data);
}
