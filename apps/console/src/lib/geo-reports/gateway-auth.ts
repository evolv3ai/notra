import { NextResponse } from "next/server";

import { hasAdminRole } from "@/lib/auth/role";
import { getServerSession } from "@/lib/auth/session";

/** Shared guard for the GEO automation routes: admin session + gateway key. */
export async function requireGeoAutomation() {
  const { user } = await getServerSession();
  if (!(user && hasAdminRole(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY is not configured" },
      { status: 503 }
    );
  }
  return null;
}
