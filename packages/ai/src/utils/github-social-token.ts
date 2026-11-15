import type { socialConnections } from "@notra/db/schema";
import { decryptToken } from "@notra/db/utils/integration-encryption";

export function resolveGitHubSocialToken(
  connection: Pick<
    typeof socialConnections.$inferSelect,
    "encryptedAccessToken"
  >
) {
  return connection.encryptedAccessToken
    ? decryptToken(connection.encryptedAccessToken)
    : null;
}
