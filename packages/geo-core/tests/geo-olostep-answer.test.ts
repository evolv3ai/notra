import { describe, expect, test } from "bun:test";

import { geoOlostepAnswerSchema } from "../src/schemas/geo-olostep";
import { geoOlostepAnswer } from "../src/utils/geo-olostep-answer";

const answerOf = (payload: unknown) =>
  geoOlostepAnswer(geoOlostepAnswerSchema.parse(payload));

describe("Olostep AI Overview answers", () => {
  test("a reported missing overview is stored as a miss", () => {
    const answer = answerOf({
      answer_markdown: "",
      sources: [],
      text_blocks: [],
      message: "no-ai-overview-found",
    });
    expect(answer.absent).toBe(true);
    expect(answer.text).toBe("");
  });

  test("an empty or unrecognized payload is not a miss", () => {
    for (const payload of [{}, { message: "rate-limited" }]) {
      const answer = answerOf(payload);
      expect(answer.absent).toBe(false);
      expect(answer.text).toBe("");
    }
  });

  test("an overview with text is a regular answer", () => {
    const answer = answerOf({
      answer_markdown: "Yes, creatine is generally safe.",
      sources: [{ url: "https://www.mayoclinic.org/creatine", title: "Mayo" }],
    });
    expect(answer.absent).toBe(false);
    expect(answer.sources).toEqual([
      { title: "Mayo", url: "https://www.mayoclinic.org/creatine" },
    ]);
  });
});

describe("Olostep sources", () => {
  const panel = {
    answer_markdown: "Rally and Collectable sell card shares.",
    sources: [
      { url: "https://rallyrd.com/", title: "Rally", cited: false },
      { url: "https://www.si.com/collectibles", title: "SI", cited: false },
    ],
  };

  test("uncited search candidates are dropped by default", () => {
    expect(answerOf(panel).sources).toEqual([]);
  });

  test("an engine whose panel is its citations keeps every panel source", () => {
    const answer = geoOlostepAnswer(geoOlostepAnswerSchema.parse(panel), {
      panelSourcesCited: true,
    });
    expect(answer.sources).toEqual([
      { title: "Rally", url: "https://rallyrd.com/" },
      { title: "SI", url: "https://www.si.com/collectibles" },
    ]);
    expect(answer.grounding.sources.map(({ domain }) => domain)).toEqual([
      "rallyrd.com",
      "si.com",
    ]);
  });
});

describe("Olostep commercial surfaces", () => {
  test("keeps advertisers, products and the model from a ChatGPT result", () => {
    const answer = answerOf({
      answer_markdown: "Try the Soundcore Space Q45.",
      ads: [
        {
          brand: { name: "Razer", url: "https://www.razer.com/" },
          cards: [
            {
              title: "BlackShark",
              url: "https://www.razer.com/x?utm_source=chatgpt",
            },
          ],
        },
      ],
      products: [
        {
          title: "Soundcore Space Q45",
          price: 139.99,
          currency: "$",
          vendors: [{ website: "Best Buy", link: "https://www.bestbuy.com/p" }],
        },
      ],
      web_searched: true,
      network_search_calls: {
        search_triggered: true,
        model_slug: "auto",
        search_queries: [],
      },
    });
    expect(answer.surfaces).toEqual({
      provider: "olostep",
      model: "auto",
      webSearched: true,
      ads: [{ brand: "Razer", domain: "razer.com", cards: 1 }],
      products: [
        {
          title: "Soundcore Space Q45",
          price: 139.99,
          currency: "$",
          vendors: ["Best Buy"],
        },
      ],
      shoppingCards: null,
      relatedQueries: [],
    });
  });

  test("reads decimal commas and thousands separators in prices", () => {
    const prices = [
      "12,99 €",
      "$1,299.00",
      "1.299,00",
      "1,299",
      "1 299 €",
      "$10 – $20",
    ].map(
      (price) =>
        answerOf({ answer_markdown: "x", products: [{ title: "P", price }] })
          .surfaces?.products?.[0]?.price
    );
    expect(prices).toEqual([12.99, 1299, 1299, 1299, 1299, 10]);
  });

  test("an empty ads module means no ads; a missing one means unknown", () => {
    expect(answerOf({ answer_markdown: "x", ads: [] }).surfaces?.ads).toEqual(
      []
    );
    expect(answerOf({ answer_markdown: "x" }).surfaces?.ads).toBeNull();
  });

  test("a module with no readable item is unknown, not empty", () => {
    expect(
      answerOf({ answer_markdown: "x", ads: [{ brand: 42 }] }).surfaces?.ads
    ).toBeNull();
  });

  test("a malformed module or item is dropped without losing the rest", () => {
    const answer = answerOf({
      answer_markdown: "Still here.",
      ads: "sponsored",
      products: [{ title: 42 }, { title: "Kept", price: "$5" }],
      shopping_cards: [{}, {}],
    });
    expect(answer.text).toBe("Still here.");
    expect(answer.surfaces?.ads).toBeNull();
    expect(answer.surfaces?.products?.map((product) => product.title)).toEqual([
      "Kept",
    ]);
    expect(answer.surfaces?.shoppingCards).toBe(2);
  });
});
