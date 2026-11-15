import { realtime } from "@notra/ai/realtime";
import { markGeoLiveWatched } from "@notra/geo-core/geo/live";
import { geoLiveChannelOrganizations } from "@notra/geo-core/utils/geo-live";
import { handle } from "@upstash/realtime";

import { getServerSession } from "@/lib/auth/session";
import { authorizeRealtimeChannels } from "@/lib/realtime/channel-acl";

const handler = realtime
  ? handle({
      realtime,
      middleware: async ({ request, channels }) => {
        const { session, user } = await getServerSession({
          headers: request.headers,
        });

        if (!(session && user)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const denied = await authorizeRealtimeChannels({
          headers: request.headers,
          channels,
          user,
        });
        if (!denied) {
          await markGeoLiveWatched(geoLiveChannelOrganizations(channels));
        }
        return denied;
      },
    })
  : null;

export async function GET(request: Request) {
  if (!handler) {
    return Response.json({ error: "Realtime not configured" }, { status: 503 });
  }
  return handler(request);
}
