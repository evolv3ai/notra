"use client";

import { useTranslations } from "use-intl";

import { BackLink } from "@/components/layout/back-link";
import { PageContainer } from "@/components/layout/container";
import { ALL_INTEGRATIONS } from "@/lib/integrations/catalog";
import { useParams, usePathname } from "@/lib/navigation";

export function IntegrationsBackLink() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  const root = `/${slug}/integrations`;
  const [section, detail] = pathname
    .replace(/\/$/, "")
    .slice(root.length + 1)
    .split("/");

  if (!section) {
    return null;
  }

  const parent = detail
    ? ALL_INTEGRATIONS.find((integration) => integration.href === section)
    : undefined;

  return (
    <PageContainer className="-mb-4 pt-4 md:-mb-6 md:pt-6">
      <div className="px-4 lg:px-6">
        <BackLink href={parent ? `${root}/${section}` : root}>
          {parent?.name ?? t("labels.integrations")}
        </BackLink>
      </div>
    </PageContainer>
  );
}
