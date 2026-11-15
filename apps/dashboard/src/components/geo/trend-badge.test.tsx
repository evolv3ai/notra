import { expect, test } from "bun:test";

import { TrendBadge } from "@notra/ui/components/trend-badge";
import { renderToStaticMarkup } from "react-dom/server";

test.each([
  ["sm", "text-[0.625rem]", "[&amp;&gt;svg]:size-2.5"],
  ["default", "text-xs", "[&amp;&gt;svg]:size-3"],
  ["md", "text-sm", "[&amp;&gt;svg]:size-3.5"],
] as const)("plain trends honor the %s size", (size, textClass, iconClass) => {
  const html = renderToStaticMarkup(
    <TrendBadge appearance="plain" size={size} tone="up">
      +12%
    </TrendBadge>
  );
  expect(html).toContain(textClass);
  expect(html).toContain(iconClass);
});

test.each(["plain", "badge"] as const)(
  "%s trends support custom rendering",
  (appearance) => {
    const html = renderToStaticMarkup(
      <TrendBadge
        appearance={appearance}
        render={<a href="/details" />}
        tone="up"
      >
        +12%
      </TrendBadge>
    );
    expect(html).toStartWith("<a ");
    expect(html).toContain('href="/details"');
    expect(html).toContain("+12%");
    expect(html).not.toContain("render=");
  }
);

test("pill trends stay fully rounded", () => {
  const html = renderToStaticMarkup(
    <TrendBadge shape="pill" tone="up">
      +12%
    </TrendBadge>
  );
  expect(html).toContain("rounded-full");
});
