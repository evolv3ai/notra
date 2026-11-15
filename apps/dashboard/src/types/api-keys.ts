import type { IconSvgElement } from "@hugeicons/react";
import type {
  API_KEY_ACCESS_MODE_VALUES,
  API_KEY_EXPIRATION_VALUES,
  API_KEY_GRANULAR_PERMISSIONS,
} from "@notra/schemas/constants/dashboard/api-keys";
import type { PermissionTone } from "@notra/ui/components/ui/permission-selector";
import type { KeyResponseData } from "@unkey/api/models/components";

import type {
  API_KEY_PERMISSION_SUMMARY,
  API_KEY_PRESET_IDS,
} from "@/constants/api-keys";
export type ApiKeyGranularScope = (typeof API_KEY_GRANULAR_PERMISSIONS)[number];
type ApiKeyPresetId = (typeof API_KEY_PRESET_IDS)[number];
export type ApiKeyExpiration = (typeof API_KEY_EXPIRATION_VALUES)[number];
export type ApiKeyAccessMode = (typeof API_KEY_ACCESS_MODE_VALUES)[number];
export type ApiKeyStatus = "active" | "expiringSoon" | "expired" | "disabled";

export interface ApiKeyPreset {
  id: ApiKeyPresetId;
  icon: IconSvgElement;
  title: string;
  description: string;
  docsHref: string;
  defaultName: string;
  accessMode: ApiKeyAccessMode;
  scopes: ApiKeyGranularScope[];
  expiration: ApiKeyExpiration;
}

interface ApiKeyScopeLevel {
  value: string;
  tone: PermissionTone;
  scopes: ApiKeyGranularScope[];
}

export interface ApiKeyScopeGroup {
  id: string;
  label: string;
  description: string;
  readScope: ApiKeyGranularScope;
  writeScope: ApiKeyGranularScope;
  levels: ApiKeyScopeLevel[];
}

export interface TrackingTokenCardProps {
  organizationId: string;
}

export interface ApiKeyRevealFieldProps {
  value: string;
  className?: string;
}

export interface ApiKeyPermissionSelectorProps {
  accessMode: ApiKeyAccessMode;
  value: string[];
  onAccessModeChange: (
    accessMode: ApiKeyAccessMode,
    scopes: ApiKeyGranularScope[]
  ) => void;
  onValueChange: (scopes: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export interface ApiKeyFormValues {
  keyId: string;
  name: string;
  accessMode: ApiKeyAccessMode;
  scopes: string[];
  expiration: ApiKeyExpiration;
}

export type ApiKeyCreateConfig = Omit<ApiKeyFormValues, "keyId">;

/** A key row as the dashboard lists it, for organization and account keys alike. */
export type ApiKeyListItem = Pick<
  KeyResponseData,
  "keyId" | "start" | "createdAt" | "enabled"
> & {
  name: string;
  accessMode: ApiKeyAccessMode;
  expires: number | null;
  permission: (typeof API_KEY_PERMISSION_SUMMARY)[number];
  permissions: string[];
  createdBy: string | null;
  accountWide: boolean;
};

export interface ApiKeyStatusBadgeProps {
  status: ApiKeyStatus;
}

export interface ApiKeyPermissionBadgeProps {
  permission: ApiKeyListItem["permission"];
}
