import type { SocialPublishSurface } from "@notra/schemas/dashboard/social-accounts";

import type { PublishSocialPostParams } from "@/types/services/social-connect";

export type PublishSocialPostInput = Pick<
  PublishSocialPostParams,
  "accountId" | "content" | "mediaUrls"
> & {
  from?: SocialPublishSurface;
};

export interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  verified: boolean;
  verifiedType: string | null;
  createdAt: string;
}
