import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { redirect } from "next/navigation";

export function GET(request: Request) {
  const url = new URL(
    "/signup",
    process.env.NOTRA_DASHBOARD_URL ?? "https://app.usenotra.com"
  );
  const returnTo = sanitizeReturnTo(
    new URL(request.url).searchParams.get("returnTo")
  );
  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }
  redirect(url.href);
}
