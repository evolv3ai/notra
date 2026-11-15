"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  SITE_BRANCH_DESTRUCTIVE_DIALOG_KINDS,
  SITE_BRANCH_DIALOG_TITLES,
} from "@/constants/site-branches";
import type {
  SiteBranchBringFieldsProps,
  SiteBranchDialogDescriptionProps,
  SiteBranchDialogProps,
} from "@/types/site-branches";

function SiteBranchDialogDescription({
  action,
}: SiteBranchDialogDescriptionProps) {
  const t = useTranslations("sites.branches");
  if (action?.kind === "discardDeleted" && action.branches) {
    return t("discardDeletedManyDescription", {
      count: action.branches.length,
    });
  }
  if (action?.kind === "delete") {
    return t("deleteDescription", { branch: action.branch });
  }
  if (action?.kind === "discardDeleted") {
    return t("discardDeletedDescription", { branch: action.branch });
  }
  return t("nameHint");
}

function SiteBranchBringFields({
  name,
  draftCount,
  bring,
  onBringChange,
}: SiteBranchBringFieldsProps) {
  const t = useTranslations("sites.branches");
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="mb-2">{t("pending", { count: draftCount })}</legend>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={bring}
          onChange={() => onBringChange(true)}
        />
        {t("bring")}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={!bring}
          onChange={() => onBringChange(false)}
        />
        {t("leave")}
      </label>
      <p className="text-muted-foreground text-xs">
        {t("originalKeepsChanges")}
      </p>
    </fieldset>
  );
}

export function SiteBranchDialog({
  action,
  draftCount,
  loading,
  onClose,
  onConfirm,
}: SiteBranchDialogProps) {
  const t = useTranslations("sites.branches");
  const common = useTranslations("common");
  const id = useId();
  const [title, setTitle] = useState("");
  const [bring, setBring] = useState(true);
  const kind = action?.kind ?? "create";
  const destructive = SITE_BRANCH_DESTRUCTIVE_DIALOG_KINDS.has(kind);
  return (
    <ResponsiveDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!(open || loading)) {
          onClose();
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t(SITE_BRANCH_DIALOG_TITLES[kind])}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            <SiteBranchDialogDescription action={action} />
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          id={id}
          action={() => onConfirm(title, bring)}
          className="space-y-4"
        >
          {destructive ? null : (
            <div className="space-y-2">
              <Label htmlFor={`${id}-title`}>{t("title")}</Label>
              <Input
                id={`${id}-title`}
                autoComplete="off"
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required={kind === "rename"}
              />
            </div>
          )}
          {kind === "create" && draftCount > 0 ? (
            <SiteBranchBringFields
              name={`${id}-bring`}
              draftCount={draftCount}
              bring={bring}
              onBringChange={setBring}
            />
          ) : null}
        </form>
        <ResponsiveDialogFooter>
          <Button variant="outline" disabled={loading} onClick={onClose}>
            {common("actions.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={loading}
            type="submit"
            form={id}
          >
            {t(kind)}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
