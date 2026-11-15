import { getTranslations } from "@/lib/i18n/server";
import { assertNotDemo, tooManyRequests } from "@/lib/orpc/utils/errors";
import { ratelimit } from "@/utils/ratelimit";

export async function assertContentPublishAllowed(
  userId: string,
  organizationId: string
) {
  assertNotDemo();
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const { success } = await ratelimit.githubPublish.limit(
      `${userId}:${organizationId}`
    );
    if (!success) {
      throw tooManyRequests(
        (await getTranslations("errors.content"))("tooManyPublishRequests")
      );
    }
  }
}
