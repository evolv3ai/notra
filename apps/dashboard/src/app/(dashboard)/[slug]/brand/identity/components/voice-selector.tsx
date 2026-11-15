import {
  Delete02Icon,
  Edit02Icon,
  MoreVerticalIcon,
  Refresh03Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { AffectedTriggersWarning } from "@/components/affected-triggers-warning";
import { Button } from "@/components/button";
import { IDENTITY_NAME_MAX_LENGTH } from "@/constants/brand-identity";
import type {
  VoiceActionsMenuProps,
  VoiceCardsProps,
  VoiceSelectorProps,
  VoiceSummaryProps,
} from "@/types/brand-identity";
import type { BrandSettings } from "@/types/hooks/brand-analysis";
import { getBrandFaviconUrl } from "@/utils/brand";
import { getWebsiteDisplayText } from "@/utils/brand-identity";
import { truncateText } from "@/utils/format";

import { useUpdateBrandSettings } from "../../../../../../lib/hooks/use-brand-analysis";

export function VoiceSelector({
  layout = "cards",
  voices,
  activeVoiceId,
  onSelect,
  organizationId,
  onReanalyze,
  isReanalyzing,
  onDelete,
  isDeleting,
  onSetDefault,
  isSettingDefault,
  affectedSchedules,
  affectedEvents,
  isLoadingAffected,
  isDeleteDialogOpen,
  onRequestDelete,
  onDeleteDialogChange,
}: VoiceSelectorProps) {
  const t = useTranslations("brand.identity.voiceSelector");
  const tBrandShared = useTranslations("brand.shared");
  const tCommon = useTranslations("common.actions");
  const updateMutation = useUpdateBrandSettings(organizationId);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [identityName, setIdentityName] = useState("");

  const activeVoice = voices.find((v) => v.id === activeVoiceId);

  const handleIdentityRename = async () => {
    const trimmedName = identityName.trim();

    if (!trimmedName) {
      toast.error(tBrandShared("enterAnIdentityName"));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: activeVoiceId,
        name: trimmedName,
      });
      toast.success(t("nameUpdated"));
      setEditDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    }
  };

  const menuProps = (voice: BrandSettings) => ({
    disabled: isDeleting || isSettingDefault || isReanalyzing,
    isReanalyzing,
    label: t("optionsLabel", { name: voice.name }),
    onEditName: () => {
      onSelect(voice.id);
      setIdentityName(voice.name);
      setEditDialogOpen(true);
    },
    onOpen: () => {
      if (voice.id !== activeVoiceId) {
        onSelect(voice.id);
      }
    },
    onReanalyze: () => {
      onSelect(voice.id);
      if (voice.websiteUrl) {
        onReanalyze(voice.websiteUrl);
      }
    },
    onRequestDelete: () => onRequestDelete(voice.id),
    onSetDefault: () => {
      onSelect(voice.id);
      onSetDefault();
    },
    voice,
  });

  return (
    <>
      {layout === "cards" ? (
        <VoiceCards
          activeVoiceId={activeVoiceId}
          menuProps={menuProps}
          onSelect={onSelect}
          voices={voices}
        />
      ) : null}

      {layout === "summary" && activeVoice ? (
        <VoiceSummary menuProps={menuProps(activeVoice)} voice={activeVoice} />
      ) : null}

      {layout === "menu" && activeVoice ? (
        <VoiceActionsMenu
          {...menuProps(activeVoice)}
          render={<Button size="icon" variant="outline" />}
        />
      ) : null}

      <ResponsiveDialog
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setIdentityName(activeVoice?.name ?? "");
          }
        }}
        open={isEditDialogOpen}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("editName")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("editDescription")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleIdentityRename();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="identity-name">{t("nameLabel")}</Label>
              <Input
                autoFocus
                id="identity-name"
                onChange={(event) => setIdentityName(event.target.value)}
                placeholder={t("namePlaceholder")}
                value={identityName}
              />
            </div>
            <ResponsiveDialogFooter>
              <ResponsiveDialogClose
                disabled={updateMutation.isPending}
                render={
                  <Button
                    className="w-full justify-center sm:w-auto"
                    variant="outline"
                  />
                }
              >
                {tCommon("cancel")}
              </ResponsiveDialogClose>
              <Button
                className="w-full justify-center sm:w-auto"
                disabled={!identityName.trim() || updateMutation.isPending}
                type="submit"
                data-dialog-confirm
              >
                {updateMutation.isPending ? tCommon("saving") : tCommon("save")}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        onOpenChange={onDeleteDialogChange}
        open={isDeleteDialogOpen}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("deleteTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("deleteDescription")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <AffectedTriggersWarning
            events={affectedEvents}
            isLoading={isLoadingAffected}
            resourceLabel="identity"
            schedules={affectedSchedules}
          />

          <ResponsiveDialogFooter>
            <ResponsiveDialogClose
              disabled={isDeleting}
              render={
                <Button
                  className="w-full justify-center sm:w-auto"
                  variant="outline"
                />
              }
            >
              {tCommon("cancel")}
            </ResponsiveDialogClose>
            <Button
              className="w-full justify-center sm:w-auto"
              disabled={isDeleting}
              onClick={() => {
                onDelete();
                onDeleteDialogChange(false);
              }}
              variant="destructive"
            >
              {isDeleting ? tCommon("deleting") : t("deleteIdentity")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

function VoiceActionsMenu({
  disabled,
  isReanalyzing,
  label,
  onEditName,
  onOpen,
  onReanalyze,
  onRequestDelete,
  onSetDefault,
  nativeButton = true,
  render,
  triggerClassName,
  voice,
}: VoiceActionsMenuProps) {
  const t = useTranslations("brand.identity.voiceSelector");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={triggerClassName}
        disabled={disabled}
        nativeButton={nativeButton}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        render={render}
      >
        <HugeiconsIcon
          className="text-muted-foreground size-3.5"
          icon={MoreVerticalIcon}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEditName();
          }}
        >
          <HugeiconsIcon className="size-4" icon={Edit02Icon} />
          {t("editName")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!voice.websiteUrl?.trim() || isReanalyzing}
          onClick={(e) => {
            e.stopPropagation();
            onReanalyze();
          }}
        >
          <HugeiconsIcon className="size-4" icon={Refresh03Icon} />
          {t("reanalyze")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={voice.isDefault}
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault();
          }}
        >
          <HugeiconsIcon className="size-4" icon={StarIcon} />
          {voice.isDefault ? t("alreadyDefault") : t("setDefault")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={voice.isDefault}
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
          variant="destructive"
        >
          <HugeiconsIcon className="size-4" icon={Delete02Icon} />
          {t("deleteIdentity")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VoiceCards({
  activeVoiceId,
  menuProps,
  onSelect,
  voices,
}: VoiceCardsProps) {
  const t = useTranslations("brand.identity.voiceSelector");
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {voices.map((voice) => {
        const isActive = voice.id === activeVoiceId;
        const hasTooltipInfo =
          voice.toneProfile || voice.language || voice.isDefault;

        return (
          <button
            className={`group flex max-w-72 min-w-40 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border py-2.5 pr-2 pl-3 text-left transition-colors ${
              isActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
            key={voice.id}
            onClick={() => onSelect(voice.id)}
            type="button"
          >
            <Avatar
              className="size-8 shrink-0 rounded-full after:rounded-full"
              size="sm"
            >
              <AvatarImage src={getBrandFaviconUrl(voice.websiteUrl)} />
              <AvatarFallback>
                {voice.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {hasTooltipInfo ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="block cursor-help truncate text-sm leading-5 font-medium">
                        {truncateText(voice.name, IDENTITY_NAME_MAX_LENGTH)}
                      </span>
                    }
                  />
                  <TooltipContent className="max-w-64 space-y-1 wrap-anywhere">
                    {voice.toneProfile && (
                      <p>{t("toneProfile", { tone: voice.toneProfile })}</p>
                    )}
                    {voice.language && (
                      <p>{t("language", { language: voice.language })}</p>
                    )}
                    {voice.isDefault && <p>{t("defaultTooltip")}</p>}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="block truncate text-sm leading-5 font-medium">
                  {truncateText(voice.name, IDENTITY_NAME_MAX_LENGTH)}
                </span>
              )}
              {voice.websiteUrl ? (
                <p className="text-muted-foreground truncate text-xs leading-4">
                  {getWebsiteDisplayText(voice.websiteUrl)}
                </p>
              ) : null}
            </div>
            <VoiceActionsMenu
              {...menuProps(voice)}
              nativeButton={false}
              render={<span />}
              triggerClassName={`hover:bg-accent flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function VoiceSummary({ menuProps, voice }: VoiceSummaryProps) {
  const tLabels = useTranslations("common.labels");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0 rounded-lg after:rounded-lg" size="sm">
        <AvatarImage
          className="rounded-lg"
          src={getBrandFaviconUrl(voice.websiteUrl)}
        />
        <AvatarFallback className="rounded-lg">
          {voice.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-medium">{voice.name}</span>
          {voice.isDefault ? (
            <Badge variant="secondary">{tLabels("default")}</Badge>
          ) : null}
        </div>
        {voice.websiteUrl ? (
          <p className="text-muted-foreground truncate text-sm">
            {getWebsiteDisplayText(voice.websiteUrl)}
          </p>
        ) : null}
      </div>
      <VoiceActionsMenu
        {...menuProps}
        render={<Button size="icon-sm" variant="ghost" />}
        triggerClassName="text-muted-foreground"
      />
    </div>
  );
}
