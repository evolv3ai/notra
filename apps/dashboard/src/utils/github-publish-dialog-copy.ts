import type { GitHubPublishDialogCopyParams } from "@/types/content/detail";

export function githubPublishDialogCopy(params: GitHubPublishDialogCopyParams) {
  if (params.direct) {
    return { title: params.title, description: params.directDescription };
  }
  if (params.operation === "created") {
    return {
      title: params.createdTitle,
      description: params.createdDescription,
    };
  }
  if (params.operation === "updated") {
    return {
      title: params.updatedTitle,
      description: params.updatedDescription,
    };
  }
  return { title: params.title, description: params.description };
}
