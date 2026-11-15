import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import { ChatActivityStatus } from "@/components/ai/chat-activity-status";

test.each([true, false])(
  "chat activity announces its label without announcing timer ticks (active=%s)",
  (active) => {
    const html = renderToStaticMarkup(
      <IntlProvider locale="en" messages={{}}>
        <ChatActivityStatus
          active={active}
          label="Activity label"
          seconds={12}
        />
      </IntlProvider>
    );

    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain(
      '<span class="sr-only" role="status">Activity label</span>'
    );
    expect(html).toMatch(/<svg aria-hidden="true"/);
    if (active) {
      expect(html).toMatch(/<span aria-hidden="true"[^>]*>12s<\/span>/);
    }
  }
);
