import { expect, test } from "bun:test";

import { SITE_ICON_NAMES } from "@notra/sites-core/constants/site-layout";

import { ICONS } from "../src/constants/icons";

test("the validator knows exactly the icons the theme bundles", () => {
  expect(Object.keys(ICONS).sort()).toEqual([...SITE_ICON_NAMES]);
});
