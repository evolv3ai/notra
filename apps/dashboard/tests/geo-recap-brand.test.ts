import { describe, expect, test } from "bun:test";

import { recapOwnBrandName } from "../src/utils/geo-recap";

describe("weekly recap own brand name", () => {
  test("uses the tracked GEO brand rather than the project label", () => {
    expect(
      recapOwnBrandName([
        { name: "Desktop app", geoSettings: { companyName: "Acme Voice" } },
      ])
    ).toBe("Acme Voice");
  });

  test.each([null, { companyName: "" }, { companyName: "   " }])(
    "falls back to the project name when GEO settings are %j",
    (geoSettings) => {
      expect(recapOwnBrandName([{ name: "Acme Voice", geoSettings }])).toBe(
        "Acme Voice"
      );
    }
  );

  test("does not label aggregated rates as one product", () => {
    expect(
      recapOwnBrandName([
        { name: "Desktop app", geoSettings: { companyName: "Acme Voice" } },
        { name: "Mobile app", geoSettings: { companyName: "Acme Notes" } },
      ])
    ).toBe("Your products");
  });

  test("uses a neutral label when the project is unavailable", () => {
    expect(recapOwnBrandName([])).toBe("Your brand");
  });
});
