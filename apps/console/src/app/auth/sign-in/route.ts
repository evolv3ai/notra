import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { redirect } from "next/navigation";

export function GET(request: Request) {
  const returnTo = sanitizeReturnTo(
    new URL(request.url).searchParams.get("returnTo")
  );
  redirect(
    `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
  );
}
