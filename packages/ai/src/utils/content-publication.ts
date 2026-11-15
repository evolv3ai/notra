import type {
  ContentPublication,
  PublicationAncestryValidator,
  PublicationSyncResult,
  PublicationSyncRepair,
  ReconcileContentPublicationParams,
  RecordContentPublicationParams,
} from "@notra/ai/types/content-publication";
import { updatePostRecord } from "@notra/ai/utils/post-service";
import { db } from "@notra/db/drizzle";
import {
  contentPublications,
  githubAppInstallations,
  githubIntegrations,
  posts,
} from "@notra/db/schema";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { and, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";

const generatePublicationId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

function pullRequestLockKey(repository: string, pullRequestNumber: number) {
  return `${repository.toLowerCase()}#${pullRequestNumber}`;
}

async function lockPullRequest(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  repository: string,
  pullRequestNumber: number
) {
  await advisoryXactLock(tx, pullRequestLockKey(repository, pullRequestNumber));
}

function toPublication(
  row: {
    id: string;
    postId: string;
    repositoryId: string;
    owner: string;
    repo: string;
    path: string;
    branch: string;
    pullRequestNumber: number | null;
    pullRequestUrl: string | null;
    headSha: string | null;
    status: ContentPublication["status"];
  },
  post?: {
    contentType: string;
    title: string;
    markdown: string | null;
  } | null
): ContentPublication {
  if (row.pullRequestNumber === null || row.pullRequestUrl === null) {
    throw new Error("An open content publication must have a pull request");
  }
  return {
    ...row,
    pullRequestNumber: row.pullRequestNumber,
    pullRequestUrl: row.pullRequestUrl,
    contentType:
      (post?.contentType as ContentPublication["contentType"]) ?? null,
    title: post?.title ?? null,
    markdown: post?.markdown ?? null,
  };
}

function findPublicationPost(postId: string, organizationId: string) {
  return db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.organizationId, organizationId)),
    columns: {
      contentType: true,
      title: true,
      markdown: true,
    },
  });
}

export async function recordContentPublication(
  params: RecordContentPublicationParams,
  publishedAt: string
) {
  const id = generatePublicationId();
  const status = params.status ?? "open";
  return await db.transaction(async (tx) => {
    await lockPullRequest(
      tx,
      `${params.owner}/${params.repo}`,
      params.pullRequestNumber
    );
    const [post] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.id, params.postId),
          eq(posts.organizationId, params.organizationId)
        )
      )
      .for("update");
    if (!post) {
      return null;
    }

    const newer = await tx.query.contentPublications.findFirst({
      where: and(
        eq(contentPublications.organizationId, params.organizationId),
        eq(contentPublications.postId, params.postId),
        gt(contentPublications.createdAt, new Date(publishedAt)),
        or(
          ne(contentPublications.repositoryId, params.repositoryId),
          // Direct publications have no PR number, and NULL <> n is never true.
          sql`${contentPublications.pullRequestNumber} is distinct from ${params.pullRequestNumber}`
        )
      ),
      columns: { id: true },
    });
    if (newer) {
      return null;
    }

    const existingTarget = await tx.query.contentPublications.findFirst({
      where: and(
        eq(contentPublications.repositoryId, params.repositoryId),
        eq(contentPublications.pullRequestNumber, params.pullRequestNumber)
      ),
    });
    if (
      existingTarget &&
      (existingTarget.organizationId !== params.organizationId ||
        existingTarget.postId !== params.postId ||
        existingTarget.status !== "open")
    ) {
      return null;
    }

    if (status === "open") {
      await tx
        .update(contentPublications)
        .set({ status: "closed", updatedAt: new Date() })
        .where(
          and(
            eq(contentPublications.organizationId, params.organizationId),
            eq(contentPublications.postId, params.postId),
            eq(contentPublications.status, "open"),
            or(
              ne(contentPublications.repositoryId, params.repositoryId),
              ne(
                contentPublications.pullRequestNumber,
                params.pullRequestNumber
              )
            )
          )
        );
    }

    const [row] = await tx
      .insert(contentPublications)
      .values({
        id,
        organizationId: params.organizationId,
        postId: params.postId,
        repositoryId: params.repositoryId,
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        branch: params.branch,
        pullRequestNumber: params.pullRequestNumber,
        pullRequestUrl: params.pullRequestUrl,
        headSha: params.headSha ?? null,
        status,
        createdAt: new Date(publishedAt),
      })
      .onConflictDoUpdate({
        target: [
          contentPublications.repositoryId,
          contentPublications.pullRequestNumber,
        ],
        setWhere: and(
          eq(contentPublications.postId, params.postId),
          eq(contentPublications.status, "open")
        ),
        set: {
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          branch: params.branch,
          pullRequestUrl: params.pullRequestUrl,
          headSha: sql`case
            when ${contentPublications.headSha} is not distinct from ${params.previousHeadSha ?? null}
              and ${contentPublications.createdAt} <= ${publishedAt}::timestamp
            then coalesce(${params.headSha ?? null}, ${contentPublications.headSha})
            else ${contentPublications.headSha}
          end`,
          status,
          createdAt: sql`greatest(${contentPublications.createdAt}, ${publishedAt}::timestamp)`,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: contentPublications.id,
        postId: contentPublications.postId,
        repositoryId: contentPublications.repositoryId,
        owner: contentPublications.owner,
        repo: contentPublications.repo,
        path: contentPublications.path,
        branch: contentPublications.branch,
        pullRequestNumber: contentPublications.pullRequestNumber,
        pullRequestUrl: contentPublications.pullRequestUrl,
        headSha: contentPublications.headSha,
        status: contentPublications.status,
      });

    return row ?? null;
  });
}

/**
 * The delayed retry of a publication write that failed at publish time. The
 * post may have been published again since, and replaying the older write
 * would close that newer mapping, so it is skipped then.
 */
export async function reconcileContentPublication(
  { publication, publishedAt }: ReconcileContentPublicationParams,
  isAncestor?: PublicationAncestryValidator
) {
  const recorded = await recordContentPublication(publication, publishedAt);
  if (
    !isAncestor ||
    !recorded?.headSha ||
    !publication.headSha ||
    recorded.headSha === publication.headSha ||
    !(await isAncestor(recorded.headSha, publication.headSha))
  ) {
    return recorded;
  }

  const [advanced] = await db
    .update(contentPublications)
    .set({ headSha: publication.headSha, updatedAt: new Date() })
    .where(
      and(
        eq(contentPublications.id, recorded.id),
        eq(contentPublications.organizationId, publication.organizationId),
        eq(contentPublications.postId, publication.postId),
        eq(contentPublications.status, "open"),
        eq(contentPublications.headSha, recorded.headSha)
      )
    )
    .returning();
  if (!advanced) {
    throw new Error("Publication head changed during reconciliation");
  }
  return advanced;
}

/** Atomically updates a post and its publication revision if it still owns the post. */
export async function syncContentPublication(
  repair: PublicationSyncRepair,
  isAncestor: PublicationAncestryValidator
): Promise<PublicationSyncResult> {
  const snapshot = await db.query.contentPublications.findFirst({
    where: and(
      eq(contentPublications.id, repair.publicationId),
      eq(contentPublications.organizationId, repair.organizationId),
      eq(contentPublications.postId, repair.postId)
    ),
    columns: { headSha: true, status: true },
  });
  if (!snapshot || snapshot.status !== "open") {
    return { status: "superseded" };
  }
  if (snapshot.headSha === repair.commitSha) {
    return { status: "synchronized", markdown: repair.markdown };
  }
  if (
    snapshot.headSha !== null &&
    !(await isAncestor(snapshot.headSha, repair.commitSha))
  ) {
    return { status: "superseded" };
  }
  return await db.transaction(async (tx) => {
    await tx
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.id, repair.postId),
          eq(posts.organizationId, repair.organizationId)
        )
      )
      .for("update");
    const [publication] = await tx
      .select({
        id: contentPublications.id,
        headSha: contentPublications.headSha,
      })
      .from(contentPublications)
      .where(
        and(
          eq(contentPublications.id, repair.publicationId),
          eq(contentPublications.organizationId, repair.organizationId),
          eq(contentPublications.postId, repair.postId),
          eq(contentPublications.status, "open")
        )
      )
      .for("update");
    if (!publication) {
      return { status: "superseded" } as const;
    }
    if (publication.headSha === repair.commitSha) {
      return { status: "synchronized", markdown: repair.markdown } as const;
    }
    if (publication.headSha !== snapshot.headSha) {
      return { status: "retry" } as const;
    }

    await updatePostRecord(
      {
        organizationId: repair.organizationId,
        postId: repair.postId,
        markdown: repair.markdown,
        title: repair.title,
      },
      tx
    );
    await tx
      .update(contentPublications)
      .set({
        headSha: repair.commitSha,
        branch: repair.branch,
        ...(repair.path !== undefined ? { path: repair.path } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contentPublications.id, repair.publicationId));
    return { status: "synchronized", markdown: repair.markdown } as const;
  });
}

export async function closeContentPublicationForPullRequest(params: {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  merged: boolean;
  repositoryId?: string;
}) {
  return await db.transaction(async (tx) => {
    await lockPullRequest(
      tx,
      `${params.owner}/${params.repo}`,
      params.pullRequestNumber
    );
    const rows = await tx
      .update(contentPublications)
      .set({
        status: params.merged ? "merged" : "closed",
        updatedAt: new Date(),
      })
      .where(
        and(
          sql`lower(${contentPublications.owner}) = ${params.owner.toLowerCase()}`,
          sql`lower(${contentPublications.repo}) = ${params.repo.toLowerCase()}`,
          eq(contentPublications.pullRequestNumber, params.pullRequestNumber),
          params.repositoryId
            ? eq(contentPublications.repositoryId, params.repositoryId)
            : undefined,
          eq(contentPublications.status, "open")
        )
      )
      .returning({ id: contentPublications.id });
    return rows.length;
  });
}

export async function findOpenContentPublicationByPullRequest(params: {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  installationId: string;
  githubRepositoryId: string;
}): Promise<(ContentPublication & { organizationId: string }) | null> {
  const [row] = await db
    .select({ publication: contentPublications })
    .from(contentPublications)
    .innerJoin(
      githubIntegrations,
      eq(contentPublications.repositoryId, githubIntegrations.id)
    )
    .innerJoin(
      githubAppInstallations,
      eq(githubIntegrations.githubAppInstallationId, githubAppInstallations.id)
    )
    .where(
      and(
        eq(githubAppInstallations.installationId, params.installationId),
        eq(githubAppInstallations.enabled, true),
        eq(githubIntegrations.enabled, true),
        eq(githubIntegrations.repositoryEnabled, true),
        eq(githubIntegrations.githubRepositoryId, params.githubRepositoryId),
        sql`lower(${contentPublications.owner}) = ${params.owner.toLowerCase()}`,
        sql`lower(${contentPublications.repo}) = ${params.repo.toLowerCase()}`,
        eq(contentPublications.pullRequestNumber, params.pullRequestNumber),
        eq(contentPublications.status, "open")
      )
    )
    .limit(1);
  const publication = row?.publication;
  if (!publication) {
    return null;
  }
  const post = await findPublicationPost(
    publication.postId,
    publication.organizationId
  );
  return {
    ...toPublication(publication, post),
    organizationId: publication.organizationId,
  };
}

export async function findContentPublicationForPullRequest(params: {
  organizationId: string;
  owner: string;
  repo: string;
  pullRequestNumber: number;
}): Promise<ContentPublication | null> {
  const publication = await db.query.contentPublications.findFirst({
    where: and(
      eq(contentPublications.organizationId, params.organizationId),
      sql`lower(${contentPublications.owner}) = ${params.owner.toLowerCase()}`,
      sql`lower(${contentPublications.repo}) = ${params.repo.toLowerCase()}`,
      eq(contentPublications.pullRequestNumber, params.pullRequestNumber),
      eq(contentPublications.status, "open")
    ),
    orderBy: [desc(contentPublications.updatedAt)],
  });
  if (!publication) {
    return null;
  }
  const post = await findPublicationPost(
    publication.postId,
    params.organizationId
  );
  return toPublication(publication, post);
}

export async function findOpenContentPublicationForPost(params: {
  organizationId: string;
  postId: string;
}): Promise<ContentPublication | null> {
  const publication = await db.query.contentPublications.findFirst({
    where: and(
      eq(contentPublications.organizationId, params.organizationId),
      eq(contentPublications.postId, params.postId),
      eq(contentPublications.status, "open")
    ),
  });
  if (!publication) {
    return null;
  }
  const post = await findPublicationPost(
    publication.postId,
    params.organizationId
  );
  return toPublication(publication, post);
}
