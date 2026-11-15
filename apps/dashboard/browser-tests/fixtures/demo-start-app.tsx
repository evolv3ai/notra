import { StrictMode } from "react";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { DemoStart } from "../../src/components/demo/demo-start";
import type { DemoStartProps } from "../../src/types/demo";

export function DemoStartApp(props: DemoStartProps) {
  return (
    <StrictMode>
      <IntlProvider locale="en" messages={{ demo: messages.demo }}>
        <DemoStart {...props} />
      </IntlProvider>
    </StrictMode>
  );
}
