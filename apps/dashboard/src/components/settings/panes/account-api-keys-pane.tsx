"use client";

import { AccountApiKeysSection } from "@/components/api-keys/account-api-keys-section";
import { SettingsPane } from "@/components/settings/settings-pane";

export function AccountApiKeysSettingsPane() {
  return (
    <SettingsPane>
      <AccountApiKeysSection />
    </SettingsPane>
  );
}
