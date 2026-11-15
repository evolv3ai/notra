"use client";

import { Spinner } from "@notra/ui/components/ui/spinner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SiteBranchPrimaryActionProps } from "@/types/site-branches";
import { siteBranchPrimaryState } from "@/utils/site-branch-primary-state";

export function SiteBranchPrimaryAction(props: SiteBranchPrimaryActionProps) {
  const t = useTranslations("sites.branches");
  const state = siteBranchPrimaryState(props);
  const pr = props.status?.pullRequest;
  const actions = {
    create: props.onCreate,
    publish: props.onPublish,
    requestReview: () => props.onReview(false),
    merge: () => props.onReview(true),
  };
  return (
    <>
      <Button
        data-dialog-confirm
        size="sm"
        aria-describedby={props.describedBy}
        disabled={state.disabled && !props.error}
        loading={props.busy}
        aria-busy={props.busy || props.checking || undefined}
        onClick={props.error ? props.onPublish : actions[state.action]}
      >
        {props.checking ? (
          <Spinner aria-hidden="true" className="size-3" />
        ) : null}
        {props.error ? t("reviewIssues") : t(state.action)}
      </Button>
      {state.action === "merge" && pr?.mergeable === "CONFLICTING" ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {t("mergeConflicts")}{" "}
          <a
            className="underline"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
          >
            {t("openPullRequest")}
          </a>
        </p>
      ) : null}
    </>
  );
}
