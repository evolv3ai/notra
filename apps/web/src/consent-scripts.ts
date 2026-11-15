import { databuddy } from "@c15t/integrations/databuddy";

import { DUB_ANALYTICS_SCRIPT } from "@/constants/dub";

const databuddyClientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;

export const consentScripts = [
  DUB_ANALYTICS_SCRIPT,
  ...(databuddyClientId
    ? [
        databuddy({
          clientId: databuddyClientId,
          configWhenGranted: { disabled: false },
          configWhenDenied: { disabled: true },
        }),
      ]
    : []),
];
