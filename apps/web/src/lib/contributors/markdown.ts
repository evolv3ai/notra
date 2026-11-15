import { AUTH_SIGNUP_URL } from "@/constants/auth";
import {
  CONTRIBUTORS_HEADING,
  CONTRIBUTORS_HERO_SUBTITLE,
  CONTRIBUTORS_HERO_TITLE,
  CONTRIBUTORS_SUBCOPY,
} from "@/constants/contributors";
import { fetchContributorsData, formatContributionCount } from "@/utils/github";
import { markdownSection } from "@/utils/markdown";

export async function buildContributorsMarkdown(): Promise<string> {
  const data = await fetchContributorsData();

  const contributorLines =
    data.contributors.length > 0
      ? data.contributors.map((contributor) => {
          const count = formatContributionCount(contributor.contributions);
          const plural = contributor.contributions === 1 ? "" : "s";
          return `- [${contributor.login}](${contributor.html_url}): ${count} contribution${plural}`;
        })
      : ["Unable to load contributors right now. Try again later."];

  return [
    `# ${CONTRIBUTORS_HERO_TITLE}`,
    "",
    CONTRIBUTORS_HERO_SUBTITLE,
    "",
    `- [Try Notra for free](${AUTH_SIGNUP_URL})`,
    "",
    markdownSection(CONTRIBUTORS_HEADING, [
      CONTRIBUTORS_SUBCOPY,
      "",
      ...contributorLines,
    ]),
  ].join("\n");
}
