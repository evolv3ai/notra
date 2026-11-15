import { handleGeoDrainRequest } from "@notra/geo-core/ingest/handler";
import { isGeoDrainProvider } from "@notra/geo-core/utils/geo-drain-records";

import { afterResponse } from "@/lib/framework/after-response";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider?: string }> }
): Promise<Response> {
  const { provider } = await context.params;
  if (!(provider && isGeoDrainProvider(provider))) {
    return new Response(null, { status: 404 });
  }
  return handleGeoDrainRequest(request, provider, afterResponse);
}
