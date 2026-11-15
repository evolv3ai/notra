import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useSiteBranchActions } from "@/lib/hooks/use-site-branch-actions";
import { useSiteBranchQueries } from "@/lib/hooks/use-site-branch-queries";
import type {
  SiteBranchControlsProps,
  SiteBranchDialogProps,
} from "@/types/site-branches";
import { toErrorMessage } from "@/utils/error-message";

/** Shared branch queries and actions for the site header. */
export function useSiteBranchControls(props: SiteBranchControlsProps) {
  const { onSwitch } = props;
  const t = useTranslations("sites.branches");
  const queries = useSiteBranchQueries(props);
  const [action, setAction] = useState<SiteBranchDialogProps["action"]>(null);
  const [switching, setSwitching] = useState(false);
  const mutations = useSiteBranchActions(props, action, () => {
    setAction(null);
    queries.setMenuOpen(false);
  });
  const busy =
    mutations.create.isPending ||
    mutations.edit.isPending ||
    mutations.review.isPending ||
    switching;
  const switchTo = (next: string) => {
    setSwitching(true);
    void props
      .onSave()
      .then(onSwitch.bind(null, next))
      .catch((error: unknown) =>
        toast.error(toErrorMessage(error, t("saveFailed")))
      )
      .then(() => setSwitching(false));
  };
  const startCreate = () => mutations.create.mutate("");
  const retrySave = () => {
    void props
      .onFlush()
      .catch((error: unknown) =>
        toast.error(toErrorMessage(error, t("saveFailed")))
      );
  };
  return {
    props,
    queries,
    mutations,
    action,
    setAction,
    busy,
    switchTo,
    startCreate,
    creating: mutations.create.isPending,
    retrySave,
  } as const;
}
