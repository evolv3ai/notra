import type {
  SiteIntegrationName,
  SiteIntegrationUpdate,
  SiteIntegrations,
} from "@notra/sites-core/types/site-integrations";
import type { ComponentType, SVGProps } from "react";

interface SiteIntegrationField<Key extends string = string> {
  key: Key;
  placeholder?: string;
  optional?: boolean;
  type?: "text" | "boolean";
  defaultValue?: boolean;
}

export type SiteIntegrationProvider = {
  [Id in SiteIntegrationName]: {
    id: Id;
    name: string;
    logo: ComponentType<SVGProps<SVGSVGElement>> | null;
    docsUrl: string;
    recommended?: boolean;
    fields: readonly SiteIntegrationField<
      keyof NonNullable<SiteIntegrations[Id]> & string
    >[];
  };
}[SiteIntegrationName];

export type SiteIntegrationValues = Record<string, string | boolean>;

export interface SiteIntegrationAutosaveState {
  status: "idle" | "pending" | "saving" | "saved" | "error";
  dirty: boolean;
  hasIntegration: boolean;
  error: unknown;
}

export interface SiteIntegrationAutosaveOptions {
  initial: SiteIntegrationUpdate;
  save: (update: SiteIntegrationUpdate) => Promise<unknown>;
  onChange: (state: SiteIntegrationAutosaveState) => void;
}
