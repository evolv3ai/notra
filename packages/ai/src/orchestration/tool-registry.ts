import { supportsPostSlug } from "@notra/ai/schemas/post";
import { unavailableImageRevisionToolInputSchema } from "@notra/ai/schemas/repo-image";
import {
  createGetBrandReferencesTool,
  createSearchBrandReferencesTool,
} from "@notra/ai/tools/brand-references";
import { createSearchCompanyKnowledgeTool } from "@notra/ai/tools/company-knowledge";
import { createMarkdownTools } from "@notra/ai/tools/edit-markdown";
import { exampleTool } from "@notra/ai/tools/example";
import {
  createGetGeoCompetitorShareTool,
  createGetGeoOverviewTool,
  createGetGeoProjectContextTool,
  createGetGeoPromptResultsTool,
  createListGeoProjectsTool,
} from "@notra/ai/tools/geo";
import { buildGitHubDataTools } from "@notra/ai/tools/github";
import { createImageRevisionTool } from "@notra/ai/tools/image";
import { buildLinearDataTools } from "@notra/ai/tools/linear";
import {
  createGetBrandIdentityTool,
  createListBrandIdentitiesTool,
} from "@notra/ai/tools/organization";
import { createPostDetailsTools } from "@notra/ai/tools/post-details";
import { registerSitemapTools } from "@notra/ai/tools/sitemap";
import { getSkillByName, listAvailableSkills } from "@notra/ai/tools/skills";
import { registerWebSearchTools } from "@notra/ai/tools/web-search";
import type { ResolveLinearIntegrationContext } from "@notra/ai/types/agents";
import type { AgentType } from "@notra/ai/types/brand-references";
import type {
  BuildToolSetDeps,
  BuildToolSetParams,
  LinearContext,
  RepoContext,
  ToolSet,
  ValidatedIntegration,
} from "@notra/ai/types/orchestration";
import { logWarn } from "@notra/ai/utils/server-log";
import { type Tool, tool } from "ai";

export function buildToolSet(
  params: BuildToolSetParams,
  deps?: BuildToolSetDeps
): ToolSet {
  if (deps?.skipTools) {
    return { tools: {}, descriptions: [] };
  }

  const {
    organizationId,
    currentMarkdown,
    contentType,
    currentPostId,
    userId,
    imageContext,
    useMarkup,
    chargeAiCredits,
    onMarkdownUpdate,
    validatedIntegrations,
  } = params;

  const isImageContent = contentType === "image";

  const isDev = process.env.NODE_ENV === "development";

  const tools: Record<string, Tool> = {
    listAvailableSkills: listAvailableSkills({ organizationId }),
    getSkillByName: getSkillByName({ organizationId }),
  };

  const descriptions: string[] = [
    "**Skills**: Access knowledge and writing guidelines using listAvailableSkills and getSkillByName. If the user writes /skill-name, load that skill with getSkillByName before responding.",
  ];

  registerWebSearchTools(tools, descriptions);
  registerSitemapTools(tools, descriptions, { organizationId });
  registerBrandAndGeoTools(tools, descriptions, organizationId, contentType);

  if (isImageContent) {
    if (currentPostId && userId && imageContext?.canRevise) {
      tools.reviseImage = createImageRevisionTool({
        organizationId,
        userId,
        postId: currentPostId,
        useMarkup,
        chargeAiCredits,
      });
      descriptions.unshift(
        "**Image Editing**: Revise the current image using reviseImage. Marketing images restore the saved sandbox snapshot, apply the visual change, and store a new snapshot. Diagrams are edited directly in seconds; set useRepository only when the change needs new facts from the code. Call reviseImage once per request and describe the whole change in one prompt."
      );
    } else {
      tools.reviseImage = createUnavailableImageRevisionTool();
      descriptions.unshift(
        "**Image Editing**: Image revision is unavailable because there is neither a valid editable diagram nor the sandbox metadata needed for marketing-image edits. Call reviseImage to explain this limitation."
      );
    }
  } else {
    const { getMarkdown, editMarkdown } = createMarkdownTools({
      currentMarkdown,
      onUpdate:
        onMarkdownUpdate ??
        (() => {
          logWarn("[Tool Registry] onMarkdownUpdate is not set");
        }),
    });

    tools.getMarkdown = getMarkdown;
    tools.editMarkdown = editMarkdown;
    descriptions.unshift(
      "**Markdown Editing**: View and edit the document using getMarkdown and editMarkdown"
    );

    if (currentPostId && contentType && supportsPostSlug(contentType)) {
      const { getPostDetails, updatePostDetails } = createPostDetailsTools({
        organizationId,
        postId: currentPostId,
      });
      tools.getPostDetails = getPostDetails;
      tools.updatePostDetails = updatePostDetails;
      descriptions.unshift(
        "**Post Details**: Read and change the cover image, tags, excerpt, authors, featured flag, search visibility and shown date (the Overview tab) using getPostDetails and updatePostDetails. These are not part of the markdown."
      );
    }
  }

  if (isDev) {
    tools.example = exampleTool();
    descriptions.push(
      "**Example (testing)**: A dummy tool triggered when the user says 'example' — echoes a message for UI testing"
    );
  }

  if (hasGitHubRepositories(validatedIntegrations)) {
    Object.assign(
      tools,
      buildGitHubDataTools({
        organizationId,
        allowedIntegrationIds: uniqueIntegrationIds(
          validatedIntegrations,
          "github"
        ),
        resolveContext: deps?.resolveContext,
      })
    );

    const repos = getGitHubRepoList(validatedIntegrations);
    descriptions.push(
      `**GitHub Integration**: Fetch PRs, releases, and commits from: ${repos}`
    );
  }

  registerLinearTools(
    tools,
    descriptions,
    organizationId,
    validatedIntegrations,
    deps?.resolveLinearContext
  );

  return { tools, descriptions };
}

function registerBrandAndGeoTools(
  tools: Record<string, Tool>,
  descriptions: string[],
  organizationId: string,
  contentType?: string
) {
  const agentType = brandAgentTypeFromContent(contentType);

  tools.listBrandIdentities = createListBrandIdentitiesTool({
    organizationId,
  });
  tools.getBrandIdentity = createGetBrandIdentityTool({ organizationId });
  tools.getBrandReferences = createGetBrandReferencesTool({
    organizationId,
    agentType,
  });
  tools.searchBrandReferences = createSearchBrandReferencesTool({
    organizationId,
    agentType,
  });
  tools.searchCompanyKnowledge = createSearchCompanyKnowledgeTool({
    organizationId,
  });
  tools.listGeoProjects = createListGeoProjectsTool({ organizationId });
  tools.getGeoOverview = createGetGeoOverviewTool({ organizationId });
  tools.getGeoPromptResults = createGetGeoPromptResultsTool({
    organizationId,
  });
  tools.getGeoCompetitorShare = createGetGeoCompetitorShareTool({
    organizationId,
  });
  tools.getGeoProjectContext = createGetGeoProjectContextTool({
    organizationId,
  });

  descriptions.push(
    "**Brand**: Load company and voice details with listBrandIdentities and getBrandIdentity. Match writing style with getBrandReferences or searchBrandReferences before drafting. Look up positioning, competitors and covered topics from onboarding research with searchCompanyKnowledge. Pass the same brandIdentityId to sitemap and brand-reference tools when writing for a non-default brand."
  );
  descriptions.push(
    "**GEO Analytics**: List GEO projects, then inspect AI visibility, prompt wins/losses, competitor share, and project context with listGeoProjects, getGeoOverview, getGeoPromptResults, getGeoCompetitorShare, and getGeoProjectContext."
  );
}

function brandAgentTypeFromContent(
  contentType?: string
): AgentType | undefined {
  if (contentType === "blog_post") {
    return "blog";
  }
  if (contentType === "twitter_post") {
    return "twitter";
  }
  if (contentType === "linkedin_post") {
    return "linkedin";
  }
  if (contentType === "changelog") {
    return "changelog";
  }
  return undefined;
}

function createUnavailableImageRevisionTool(): Tool {
  return tool({
    description:
      "Explain why this image cannot be revised without an editable diagram or saved sandbox metadata.",
    inputSchema: unavailableImageRevisionToolInputSchema,
    execute: async () => ({
      status: "unavailable",
      message:
        "This image has no editable diagram or saved sandbox metadata needed to revise it.",
    }),
  });
}

export function hasGitHubRepositories(
  integrations: ValidatedIntegration[]
): boolean {
  return integrations.some(
    (i) => i.type === "github" && i.repositories.length > 0
  );
}

export function uniqueIntegrationIds(
  integrations: ValidatedIntegration[],
  type: ValidatedIntegration["type"]
): string[] {
  return Array.from(
    new Set(
      integrations
        .filter((integration) => integration.type === type)
        .map((integration) => integration.id)
    )
  );
}

export function getGitHubRepoList(
  integrations: ValidatedIntegration[]
): string {
  const repos: string[] = [];
  for (const integration of integrations) {
    if (integration.type === "github") {
      for (const repo of integration.repositories) {
        repos.push(`${repo.owner}/${repo.repo}`);
      }
    }
  }
  return repos.join(", ");
}

export function registerLinearTools(
  tools: Record<string, Tool>,
  descriptions: string[],
  organizationId: string,
  integrations: ValidatedIntegration[],
  resolveContext?: ResolveLinearIntegrationContext
) {
  if (!integrations.some((i) => i.type === "linear")) {
    return;
  }

  Object.assign(
    tools,
    buildLinearDataTools({
      organizationId,
      allowedIntegrationIds: uniqueIntegrationIds(integrations, "linear"),
      resolveContext,
    })
  );

  const teams = integrations
    .flatMap((integration) =>
      integration.type === "linear"
        ? [integration.linearTeamName ?? integration.displayName]
        : []
    )
    .join(", ");
  descriptions.push(
    `**Linear Integration**: Fetch issues, projects, and cycles${teams ? ` from: ${teams}` : ""}`
  );
}

export function getRepoContextFromIntegrations(
  integrations: ValidatedIntegration[]
): RepoContext[] {
  return Array.from(
    new Set(
      integrations
        .filter((integration) => integration.type === "github")
        .map((integration) => integration.id)
    )
  ).map((integrationId) => ({ integrationId }));
}

export function getLinearContextFromIntegrations(
  integrations: ValidatedIntegration[]
): LinearContext[] {
  return Array.from(
    new Set(
      integrations
        .filter((integration) => integration.type === "linear")
        .map((integration) => integration.id)
    )
  ).map((integrationId) => ({ integrationId }));
}
