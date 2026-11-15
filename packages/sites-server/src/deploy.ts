import { selectProductionDeployment } from "./activation";
import { enqueueSiteDeployment, getDeployment } from "./deployments";
import { SiteInputError } from "./errors/sites";
import { getBranchHead, getCommitHead, siteRepositoryAccess } from "./github";
import type { DeployBranchHeadOptions, Site } from "./types/sites";
import { redeploymentInput } from "./utils/deployments";
import { errorMessage } from "./utils/errors";

export async function deployBranchHead(
  site: Site,
  options: DeployBranchHeadOptions
): Promise<string> {
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
  });
  const branch = options.branch ?? site.productionBranch;
  const commitSha = options.commitSha;
  const head = commitSha
    ? await getCommitHead(repository, token, commitSha).catch(
        (error: unknown) => {
          console.warn("sites.commit_metadata_failed", errorMessage(error));
          return { sha: commitSha, message: "", author: "" };
        }
      )
    : await getBranchHead(repository, token, branch);
  const previewKey = options.previewKey ?? null;
  const { jobId } = await enqueueSiteDeployment(
    {
      deduplicateCommit: Boolean(options.commitSha),
      siteId: site.id,
      kind: previewKey ? "preview" : "production",
      previewKey,
      trigger: options.trigger,
      branch,
      commitSha: head.sha,
      commitMessage: options.commitMessage ?? head.message,
      commitAuthor: head.author,
      requestedByUserId: options.userId ?? null,
      githubRepositoryId: repository.githubRepositoryId,
    },
    options.trigger === "redeploy"
      ? undefined
      : async () => {
          const current = await getBranchHead(repository, token, branch);
          if (current.sha !== head.sha) {
            throw new SiteInputError(
              "The branch moved while publishing. Publish its latest changes instead."
            );
          }
        }
  );
  return jobId;
}

export async function redeploy(
  site: Site,
  deploymentId: string,
  userId: string
): Promise<string> {
  const previous = await getDeployment(deploymentId);
  if (previous?.siteId !== site.id) {
    throw new SiteInputError("Deployment not found");
  }
  const { jobId } = await enqueueSiteDeployment(
    redeploymentInput(previous, userId)
  );
  return jobId;
}

export async function rollbackToDeployment(
  site: Site,
  deploymentId: string
): Promise<void> {
  await selectProductionDeployment(site, deploymentId);
}

export async function promoteLatestDeployment(site: Site): Promise<void> {
  await selectProductionDeployment(site, null);
}
