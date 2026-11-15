"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@notra/ui/components/ui/breadcrumb";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useContent } from "@/lib/hooks/use-content";
import { useSearchParams } from "@/lib/navigation";
import type { ContentTopbarTitleProps } from "@/types/content/topbar";

export function ContentTopbarTitle({ contentId }: ContentTopbarTitleProps) {
  const tCommon = useTranslations("common");
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const { data } = useContent(organizationId, contentId);
  const title = data?.content.title;

  return (
    <BreadcrumbPage className="block min-w-0 truncate font-medium">
      {title ?? tCommon("labels.content")}
    </BreadcrumbPage>
  );
}

export function ContentTopbarCollection({
  contentId,
}: ContentTopbarTitleProps) {
  const { activeOrganization } = useOrganizationsContext();
  const { data } = useContent(activeOrganization?.id ?? "", contentId);
  const searchParams = useSearchParams();
  const collection = data?.collection;
  if (
    !(activeOrganization && collection) ||
    searchParams.get("fromCollection") !== collection.id
  ) {
    return null;
  }

  return (
    <>
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          render={
            <Link
              className="block max-w-24 truncate sm:max-w-40"
              href={`/${activeOrganization.slug}/collection/${collection.id}`}
            >
              {collection.name}
            </Link>
          }
        />
      </BreadcrumbItem>
      <BreadcrumbSeparator>
        <HugeiconsIcon icon={ArrowRight01Icon} />
      </BreadcrumbSeparator>
    </>
  );
}
