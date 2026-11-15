import type {
  SiteDeploymentActionsContext,
  SiteDeploymentDbRow,
} from "@/types/sites-server";

export function canUndoSiteRollback(context: SiteDeploymentActionsContext) {
  return (
    context.canManageDeployments &&
    context.siteActive &&
    context.rollbackActive &&
    context.history[0]?.configHash === context.currentHash
  );
}

export function siteDeploymentActions(
  deployment: Pick<
    SiteDeploymentDbRow,
    "id" | "kind" | "status" | "configHash"
  >,
  context: SiteDeploymentActionsContext
) {
  const ready =
    deployment.kind === "production" && deployment.status === "ready";
  const live = deployment.id === context.liveDeploymentId;
  const latest = deployment.id === context.history[0]?.id;
  const canResume = ready && canUndoSiteRollback(context);
  return {
    canRollback:
      context.canManageDeployments &&
      context.siteActive &&
      ready &&
      !live &&
      !latest &&
      deployment.configHash === context.currentHash &&
      context.history.some((entry) => entry.id === deployment.id),
    canPromote: canResume && latest && !live,
    canUndoRollback: canResume && live,
  };
}
