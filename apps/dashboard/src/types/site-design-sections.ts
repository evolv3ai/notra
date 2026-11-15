import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export interface SiteDesignIssue {
  path: string;
  message: string;
}

export interface SiteDesignErrorProps {
  path?: string;
}

export interface SiteDesignAppearanceProps {
  section: string;
}
export interface SiteDesignBrandingProps {
  form: SiteDesignForm;
  update: SiteDesignFieldsProps<SiteDesignForm>["update"];
  change: (next: SiteDesignForm) => void;
}
