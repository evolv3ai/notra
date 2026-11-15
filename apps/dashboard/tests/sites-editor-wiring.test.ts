import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("visitor collection has no toggle in either traffic state", () => {
  const page = readFileSync(
    resolve(
      import.meta.dirname,
      "../src/app/(dashboard)/[slug]/geo/traffic/page-client.tsx"
    ),
    "utf8"
  );
  const emptyState = page.slice(
    page.indexOf("if (isEmptyTraffic)"),
    page.indexOf("<AiTrafficCard")
  );
  const emptyReturn = emptyState.slice(0, emptyState.indexOf("\n  return ("));
  expect(emptyReturn).toContain("<TrafficEmpty");
  expect(emptyReturn).toContain("{header}");
  expect(page).not.toContain("VisitorTrackingToggle");
  expect(page).toMatch(/const showVisitors =\s+hasWebAnalytics\(web\)/);
});

test("source details use filtered pages while the domain picker keeps its full inventory", () => {
  const page = readFileSync(
    resolve(
      import.meta.dirname,
      "../src/app/(dashboard)/[slug]/geo/traffic/page-client.tsx"
    ),
    "utf8"
  );
  const sourceCard = page.slice(
    page.indexOf("<AiTrafficCard"),
    page.indexOf("<TrafficPagesCard")
  );
  expect(sourceCard).toContain("pages={trafficPages}");
  expect(sourceCard).not.toContain("inventoryPages");
  expect(page).toContain(
    "trafficHostsFromPages(inventoryPages.data?.pages ?? [])"
  );
});

test("an empty current window with prior traffic does not recommend reinstalling tracking", () => {
  const page = readFileSync(
    resolve(
      import.meta.dirname,
      "../src/app/(dashboard)/[slug]/geo/traffic/page-client.tsx"
    ),
    "utf8"
  );
  expect(page).toContain("!sources.some((source) => source.visits > 0)");
  const empty = page.slice(
    page.indexOf("if (isEmptyTraffic)"),
    page.indexOf("<AiTrafficCard")
  );
  expect(empty).toContain("const hasPreviousTraffic");
  expect(empty).toContain("source.previousVisits");
  expect(empty).toContain("web?.totals.previousViews");
  expect(empty).toContain('title={t("emptyRangeTitle")}');
  expect(empty).toContain("<TrafficEmpty setup={ingestSetup}");
});
