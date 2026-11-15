import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../../../messages/en.json";
import { FollowersCard } from "./followers-card";

test.each([
  [15, "+5"],
  [5, "-5"],
  [10, "0"],
] as const)(
  "a follower count of %d exposes the signed change",
  (followersCount, accessibleDelta) => {
    const html = renderToStaticMarkup(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        <FollowersCard
          accounts={[
            {
              provider: "twitter",
              providerAccountId: "account",
              accountId: "account",
              username: "example",
              displayName: null,
              profileImageUrl: null,
              verified: false,
              followersCount,
              followingCount: null,
              postsCount: null,
              trackedPosts: null,
              impressions: null,
              likes: null,
              replies: null,
              reposts: null,
              quotes: null,
              bookmarks: null,
              statsCapturedAt: null,
            },
          ]}
          colorForKey={() => ({ light: "#123456", dark: "#123456" })}
          hiddenKeys={new Set()}
          markIncompleteTail={false}
          points={[
            {
              day: "2026-10-10",
              provider: "twitter",
              providerAccountId: "account",
              followersCount: 10,
            },
            {
              day: "2026-10-11",
              provider: "twitter",
              providerAccountId: "account",
              followersCount,
            },
          ]}
        />
      </IntlProvider>
    );
    expect(html).toContain(`<span class="sr-only">${accessibleDelta}</span>`);
  }
);
