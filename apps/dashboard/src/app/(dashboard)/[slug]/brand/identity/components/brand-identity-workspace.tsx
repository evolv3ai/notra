"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useTranslations } from "use-intl";

import { PageContainer } from "@/components/layout/container";
import { BRAND_IDENTITY_HEADER_LAYOUTS } from "@/constants/brand-identity";
import { useDevVariant } from "@/lib/hooks/use-dev-variant";
import type { BrandIdentityWorkspaceProps } from "@/types/brand-identity";
import { getBrandFormInitialData } from "@/utils/brand-identity";

import { AddIdentityDialog } from "./add-identity-dialog";
import { AnalysisStepper } from "./analysis-stepper";
import { BrandIdentityActions } from "./brand-identity-actions";
import { BrandIdentityTabs } from "./brand-identity-tabs";
import { VoiceSelector } from "./voice-selector";

export function BrandIdentityWorkspace({
  activeTab,
  affectedEvents,
  affectedSchedules,
  analyzePending,
  deleteVoicePending,
  dispatchUi,
  effectiveProgress,
  guidelinesRefreshPending,
  handleAddIdentityOpenChange,
  handleDeleteVoice,
  handleReanalyze,
  handleSelectVoice,
  handleSetDefault,
  isAddIdentityOpen,
  isAnalyzing,
  isLoadingAffected,
  organizationId,
  onRefreshGuidelines,
  progressError,
  selectedVoice,
  setDefaultPending,
  setActiveTab,
  startPolling,
  uiState,
  voices,
}: BrandIdentityWorkspaceProps) {
  const t = useTranslations("brand.identity.analysisAlert");
  const initialData = getBrandFormInitialData(selectedVoice);
  const headerLayout = useDevVariant(
    "brand-header",
    BRAND_IDENTITY_HEADER_LAYOUTS,
    "toolbar"
  );
  const renderVoiceSelector = (layout: "cards" | "summary" | "menu") => (
    <VoiceSelector
      activeVoiceId={selectedVoice.id}
      affectedEvents={affectedEvents}
      affectedSchedules={affectedSchedules}
      isDeleteDialogOpen={!!uiState.deleteTargetVoiceId}
      isDeleting={deleteVoicePending}
      isLoadingAffected={isLoadingAffected}
      isReanalyzing={analyzePending}
      isSettingDefault={setDefaultPending}
      layout={layout}
      onDelete={handleDeleteVoice}
      onDeleteDialogChange={(open) => {
        if (!open) {
          dispatchUi({
            type: "set-delete-target-voice-id",
            voiceId: null,
          });
        }
      }}
      onReanalyze={handleReanalyze}
      onRequestDelete={(voiceId) =>
        dispatchUi({ type: "set-delete-target-voice-id", voiceId })
      }
      onSelect={handleSelectVoice}
      onSetDefault={handleSetDefault}
      organizationId={organizationId}
      voices={voices}
    />
  );
  const actions = (
    <BrandIdentityActions
      activeTab={activeTab}
      isRefreshingGuidelines={guidelinesRefreshPending}
      menu={headerLayout === "toolbar" ? renderVoiceSelector("menu") : null}
      onAddIdentity={() =>
        dispatchUi({ type: "set-add-identity-open", open: true })
      }
      onAddReference={() =>
        dispatchUi({ type: "set-add-reference-open", open: true })
      }
      onAddSitemap={() =>
        dispatchUi({ type: "set-add-sitemap-open", open: true })
      }
      onRefreshGuidelines={onRefreshGuidelines}
      organizationId={organizationId}
      voiceId={selectedVoice.id}
    />
  );
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-5 px-4 lg:px-6">
        {headerLayout === "toolbar" ? null : (
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {renderVoiceSelector(
                headerLayout === "summary" ? "summary" : "cards"
              )}
            </div>
            {actions}
          </div>
        )}

        <AddIdentityDialog
          onCreated={(voice) => handleSelectVoice(voice.id)}
          onOpenChange={handleAddIdentityOpenChange}
          open={isAddIdentityOpen}
          organizationId={organizationId}
          startPolling={startPolling}
        />

        {isAnalyzing || progressError ? (
          <Alert variant={progressError ? "destructive" : "default"}>
            <AlertTitle>
              {progressError ? t("failedTitle") : t("runningTitle")}
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>{progressError ? progressError : t("runningDescription")}</p>
                {isAnalyzing ? (
                  <AnalysisStepper progress={effectiveProgress} />
                ) : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <BrandIdentityTabs
          activeTab={activeTab}
          toolbar={headerLayout === "toolbar" ? actions : null}
          addReferenceOpen={uiState.addReferenceOpen}
          addSitemapOpen={uiState.addSitemapOpen}
          initialData={initialData}
          isSaving={uiState.isSaving}
          onActiveTabChange={setActiveTab}
          onAddReferenceOpenChange={(open) =>
            dispatchUi({ type: "set-add-reference-open", open })
          }
          onAddSitemapOpenChange={(open) =>
            dispatchUi({ type: "set-add-sitemap-open", open })
          }
          onSavingChange={(isSaving) =>
            dispatchUi({ type: "set-is-saving", isSaving })
          }
          organizationId={organizationId}
          voiceId={selectedVoice.id}
          voiceWebsiteUrl={selectedVoice.websiteUrl}
        />
      </div>
    </PageContainer>
  );
}
