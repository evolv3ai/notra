import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import de from "../messages/de.json";
import en from "../messages/en.json";

if (!process.env.NOTRA_VARIABLES_SURFACE_WORKER) {
  for (const locale of ["en", "de"]) {
    test(`variables use shared draft form in ${locale}`, () => {
      const result = spawnSync(
        process.execPath,
        ["test", fileURLToPath(import.meta.url)],
        {
          env: { ...process.env, NOTRA_VARIABLES_SURFACE_WORKER: locale },
          timeout: 30000,
        }
      );
      expect(result.status, result.stderr?.toString()).toBe(0);
    });
  }
} else {
  let ready = true;
  mock.module("../src/components/sites/site-workspace-context", () => ({
    useSiteWorkspace: () =>
      ready
        ? {
            variableRows: [{ id: "one", name: "product_name", value: "Acme" }],
            updateVariables: () => {},
            variableError: null,
          }
        : null,
  }));
  const locale =
    process.env.NOTRA_VARIABLES_SURFACE_WORKER === "de" ? "de" : "en";
  const messages = locale === "de" ? de : en;
  const { createTranslator } = await import("use-intl/core");
  const actualIntl = await import("use-intl");
  mock.module("use-intl", () => ({
    ...actualIntl,
    useTranslations: (
      namespace: "sites.variables" | "sites.design.workspace"
    ) => createTranslator({ locale, messages, namespace }),
  }));
  const { SiteVariablesSettings } =
    await import("../src/components/sites/site-variables-settings");
  test("missing workspace renders a quiet loading state", () => {
    ready = false;
    const html = renderToStaticMarkup(<SiteVariablesSettings />);
    ready = true;
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(messages.sites.design.workspace.loading);
    expect(html).not.toContain("<input");
  });
  test("labels values and uses automatic saving", () => {
    const html = renderToStaticMarkup(
      <IntlProvider locale={locale} messages={messages}>
        <SiteVariablesSettings />
      </IntlProvider>
    );
    expect(html).toContain('value="product_name"');
    expect(html).toContain('value="Acme"');
    expect(html).toContain("{{product_name}}");
    expect(html).toContain(messages.sites.variables.add);
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("/editor");
  });
}
