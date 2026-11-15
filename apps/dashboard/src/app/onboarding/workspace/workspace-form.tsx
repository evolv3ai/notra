"use client";

import {
  onboardingWorkspaceFormFieldsSchema,
  onboardingWorkspaceFormSchema,
} from "@notra/schemas/dashboard/onboarding/workspace";
import {
  slugifyOrganization,
  slugifyOrganizationWhileTyping,
} from "@notra/schemas/utils/dashboard/organization";
import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useForm, useStore } from "@tanstack/react-form";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { OnboardingDashboardPreview } from "@/components/onboarding/dashboard-preview";
import { OnboardingEmailPrefs } from "@/components/onboarding/email-prefs";
import { HeardAboutNotraField } from "@/components/onboarding/heard-about-notra-field";
import { OrgLogoField } from "@/components/onboarding/org-logo-field";
import { PrefixedInputField } from "@/components/onboarding/prefixed-input-field";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { SlugStatusIndicator } from "@/components/onboarding/slug-status-indicator";
import { OnboardingStepViewTracker } from "@/components/onboarding/step-view-tracker";
import { ONBOARDING_STEPS } from "@/constants/analytics-events";
import { COMPANY_LOGO_DEBOUNCE_MS } from "@/constants/company-logo";
import { ONBOARDING_STEP_WORKSPACE } from "@/constants/onboarding";
import { useWorkspaceFieldError } from "@/lib/hooks/use-workspace-field-error";
import { useWorkspaceLogo } from "@/lib/hooks/use-workspace-logo";
import { useWorkspaceSlugStatus } from "@/lib/hooks/use-workspace-slug-status";
import { submitWorkspaceStep } from "@/lib/onboarding/submit-workspace-form";
import type {
  OnboardingExistingOrg,
  OnboardingPreviewFocus,
  WorkspaceFormProps,
} from "@/types/onboarding";
import {
  focusFirstInvalidWorkspaceField,
  isHeardAboutNotraSource,
  onboardingPreviewFocusProps,
} from "@/utils/onboarding";

const WEBSITE_PREFIX_REGEX = /^https?:\/\//i;

export function WorkspaceForm({
  existingOrg,
  progressHrefs,
}: WorkspaceFormProps) {
  const t = useTranslations("onboarding.workspace");
  const tCommon = useTranslations("common");
  const fieldError = useWorkspaceFieldError();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrg, setCreatedOrg] = useState<OnboardingExistingOrg>();
  const currentOrg = existingOrg ?? createdOrg;
  const isResuming = !!currentOrg;
  const logo = useWorkspaceLogo(existingOrg);
  const existingSource = existingOrg?.heardAboutNotraSource;
  const initialSource = isHeardAboutNotraSource(existingSource)
    ? existingSource
    : "";
  const isAttributionLocked = Boolean(
    existingSource || existingOrg?.heardAboutNotraOther
  );

  const form = useForm({
    defaultValues: {
      heardAboutNotraOther: existingOrg?.heardAboutNotraOther ?? "",
      heardAboutNotraSource: initialSource,
      name: existingOrg?.name ?? "",
      slug: existingOrg?.slug ?? "",
      websiteUrl: existingOrg?.websiteUrl ?? "",
      dailySummary: existingOrg?.dailySummary ?? true,
      marketingEmails: existingOrg?.marketingEmails ?? false,
    },
    validators: {
      onSubmit: onboardingWorkspaceFormSchema,
    },
    onSubmit: ({ value }) =>
      submitWorkspaceStep({
        existingOrg: currentOrg,
        onOrganizationCreated: setCreatedOrg,
        logoFile: logo.logoFile,
        logoSourceUrl: null,
        value,
        setSubmitting: setIsSubmitting,
        onError: (err) =>
          toast.error(
            err instanceof Error && err.message
              ? err.message
              : t("createFailed")
          ),
      }),
    onSubmitInvalid: ({ formApi }) =>
      focusFirstInvalidWorkspaceField(formApi.state.fieldMeta),
  });

  const slug = useStore(form.store, (state) => state.values.slug);
  const name = useStore(form.store, (state) => state.values.name);
  const [logoName] = useDebouncedValue(name, {
    wait: COMPANY_LOGO_DEBOUNCE_MS,
  });
  const [previewFocus, setPreviewFocus] =
    useState<OnboardingPreviewFocus | null>(isResuming ? null : "name");
  const slugStatus = useWorkspaceSlugStatus(
    slug,
    !isResuming &&
      onboardingWorkspaceFormFieldsSchema.shape.slug.safeParse(slug).success
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <OnboardingStepViewTracker
        isResuming={isResuming}
        step={ONBOARDING_STEPS.WORKSPACE}
      />
      <div className="flex justify-center">
        <OnboardingProgress
          current={ONBOARDING_STEP_WORKSPACE}
          hrefs={progressHrefs}
        />
      </div>

      <AuthFormHeader
        description={isResuming ? t("resumeDescription") : t("description")}
        title={isResuming ? t("resumeTitle") : t("title")}
      />

      <OnboardingDashboardPreview
        focus={previewFocus}
        logoDomain={logo.companyDomain}
        logoName={logoName}
        logoUrl={logo.logoUrl}
        name={name}
        slug={slug}
        website={logo.websiteValue}
      />

      <form
        {...onboardingPreviewFocusProps(setPreviewFocus)}
        className="mt-2 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field
          name="name"
          validators={{
            onChange: onboardingWorkspaceFormFieldsSchema.shape.name,
          }}
        >
          {(field) => (
            <div className="grid gap-2" data-preview="name">
              <Label htmlFor="name">{tCommon("labels.name")}</Label>
              <div className="flex items-center gap-2">
                <OrgLogoField
                  disabled={isSubmitting}
                  onSelect={logo.selectLogo}
                  previewUrl={logo.logoUrl}
                />
                <Input
                  aria-describedby={
                    field.state.meta.errors.length > 0
                      ? "name-error"
                      : undefined
                  }
                  aria-invalid={field.state.meta.errors.length > 0}
                  autoFocus={!isResuming}
                  className="h-11 rounded-xl px-3.5"
                  disabled={isSubmitting || isResuming}
                  id="name"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    const currentSlug = form.getFieldValue("slug");
                    if (
                      !currentSlug ||
                      currentSlug === slugifyOrganization(field.state.value)
                    ) {
                      form.setFieldValue(
                        "slug",
                        slugifyOrganization(e.target.value)
                      );
                    }
                  }}
                  placeholder={tCommon("labels.acmeInc")}
                  type="text"
                  value={field.state.value}
                />
              </div>
              <p
                className="text-destructive text-sm empty:hidden"
                id="name-error"
              >
                {fieldError(field.name, field.state.meta.errors)}
              </p>
            </div>
          )}
        </form.Field>

        <form.Field
          name="slug"
          validators={{
            onChange: onboardingWorkspaceFormFieldsSchema.shape.slug,
          }}
        >
          {(field) => (
            <PrefixedInputField
              error={fieldError(field.name, field.state.meta.errors)}
              id="slug"
              inputClassName="min-w-0 flex-1 py-0 pr-11 pl-3.5"
              inputProps={{
                autoCapitalize: "none",
                autoComplete: "off",
                autoCorrect: "off",
                disabled: isSubmitting || isResuming,
                onBlur: () => {
                  field.handleChange(slugifyOrganization(field.state.value));
                  field.handleBlur();
                },
                onChange: (e) =>
                  field.handleChange(
                    slugifyOrganizationWhileTyping(e.target.value)
                  ),
                placeholder: tCommon("labels.acmeIncSlug"),
                spellCheck: false,
                value: field.state.value,
              }}
              label={tCommon("labels.slug")}
              prefix="app.usenotra.com/"
            >
              <SlugStatusIndicator status={slugStatus} />
            </PrefixedInputField>
          )}
        </form.Field>

        <form.Field
          name="websiteUrl"
          validators={{
            onSubmit: onboardingWorkspaceFormFieldsSchema.shape.websiteUrl,
          }}
        >
          {(field) => (
            <PrefixedInputField
              error={fieldError(field.name, field.state.meta.errors)}
              id="website"
              inputClassName="flex-1 px-3.5"
              inputProps={{
                autoFocus: isResuming && !existingOrg?.hasBrand,
                disabled: isSubmitting || Boolean(existingOrg?.hasBrand),
                onBlur: field.handleBlur,
                onChange: (e) => {
                  field.handleChange(e.target.value);
                  logo.setWebsiteValue(e.target.value);
                },
                placeholder: "acme.com",
                value: field.state.value.replace(WEBSITE_PREFIX_REGEX, ""),
              }}
              label={tCommon("labels.website")}
              preview="website"
              prefix="https://"
            />
          )}
        </form.Field>

        {isAttributionLocked ? null : (
          <form.Field
            name="heardAboutNotraSource"
            validators={{
              onChange:
                onboardingWorkspaceFormFieldsSchema.shape.heardAboutNotraSource,
            }}
          >
            {(field) => (
              <form.Field
                name="heardAboutNotraOther"
                validators={{
                  onChange:
                    onboardingWorkspaceFormFieldsSchema.shape
                      .heardAboutNotraOther,
                }}
              >
                {(otherField) => (
                  <HeardAboutNotraField
                    disabled={isSubmitting}
                    onOtherBlur={otherField.handleBlur}
                    onOtherChange={otherField.handleChange}
                    onSourceChange={(value) => {
                      field.handleChange(value);
                      if (value !== "other") {
                        otherField.handleChange("");
                      }
                    }}
                    other={otherField.state.value}
                    otherError={fieldError(
                      otherField.name,
                      otherField.state.meta.errors
                    )}
                    source={field.state.value}
                    sourceError={fieldError(
                      field.name,
                      field.state.meta.errors
                    )}
                  />
                )}
              </form.Field>
            )}
          </form.Field>
        )}

        <form.Field name="dailySummary">
          {(dailyField) => (
            <form.Field name="marketingEmails">
              {(marketingField) => (
                <OnboardingEmailPrefs
                  dailySummary={dailyField.state.value}
                  disabled={isSubmitting}
                  marketingEmails={marketingField.state.value}
                  onDailySummaryChange={dailyField.handleChange}
                  onMarketingEmailsChange={marketingField.handleChange}
                />
              )}
            </form.Field>
          )}
        </form.Field>

        <CtaButton className="w-full" loading={isSubmitting} type="submit">
          {tCommon("actions.continue")}
        </CtaButton>
      </form>
    </div>
  );
}
