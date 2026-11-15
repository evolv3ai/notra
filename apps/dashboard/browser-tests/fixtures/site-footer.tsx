import { useState } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { SiteFooterFields } from "../../src/components/sites/site-footer-fields";
import { SiteSettingsList } from "../../src/components/sites/site-settings-item";
import { readDesignForm } from "../../src/utils/site-design";

function SiteFooterFixture() {
  const [form, setForm] = useState(() =>
    readDesignForm(
      location.search.includes("populated")
        ? { footer: { socials: { x: "https://x.com/synthetic" } } }
        : {}
    )
  );
  return (
    <IntlProvider locale="en" messages={messages}>
      <div className="flex h-svh flex-col overflow-hidden">
        <main className="scrollbar-stable min-h-0 flex-1 scrollbar-thin overflow-x-hidden overflow-y-auto p-8">
          <section
            className="mx-auto w-full max-w-3xl space-y-5"
            data-site-design
          >
            <header className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">Footer</h1>
              <p className="text-muted-foreground text-sm">
                Social links and link columns at the bottom of every page.
              </p>
            </header>
            <SiteSettingsList>
              <SiteFooterFields
                form={form}
                patch={(patch) =>
                  setForm((previous) => ({ ...previous, ...patch }))
                }
                update={(key, value) =>
                  setForm((previous) => ({ ...previous, [key]: value }))
                }
              />
            </SiteSettingsList>
          </section>
        </main>
      </div>
    </IntlProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<SiteFooterFixture />);
}
