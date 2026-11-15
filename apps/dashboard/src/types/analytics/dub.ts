import type { DashboardLocale } from "@/types/i18n";

export interface DubLeadInput {
  customerExternalId: string;
  customerName: string | null;
  customerEmail: string;
}

export interface DubLeadRequest extends DubLeadInput {
  apiKey: string;
  clickId: string;
  request: Request;
  locale: DashboardLocale;
}
