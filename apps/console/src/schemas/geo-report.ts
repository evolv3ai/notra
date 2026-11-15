// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import { GEO_MODELS } from "@/constants/geo-report";

const MAX_TEXT = 2000;
const MAX_LIST = 200;
const MAX_RANK = 20;
const MAX_SITE_TEXT = 12_000;
const MAX_ANSWER_TEXT = 30_000;
const PROMPT_COUNT_MAX = 20;

const modelIdSchema = z.enum(GEO_MODELS.map((model) => model.id));
const shortText = z.string().max(MAX_TEXT);
const fraction = z.number().min(0).max(1);

const geoReportSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["draft", "ready", "sent"]),
  company: z.object({
    name: shortText,
    domain: shortText,
    category: shortText,
  }),
  preparedAt: z.string(),
  preparedBy: shortText,
  summary: z.object({
    visibilityScore: z.number().min(0).max(100),
    shareOfVoice: fraction,
    shareOfVoiceRank: z.number().int().min(0).max(MAX_LIST),
    sentimentScore: z.number().min(0).max(5),
    citations: z.number().int().min(0).max(100_000),
  }),
  modelIds: z.array(modelIdSchema).max(GEO_MODELS.length),
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        text: shortText,
        intent: z.enum([
          "best-of",
          "comparison",
          "alternatives",
          "how-to",
          "pricing",
          "branded",
        ]),
        ranks: z.record(
          z.string(),
          z.number().int().min(1).max(MAX_RANK).nullable()
        ),
        answers: z
          .record(
            z.string(),
            z.object({
              text: z.string().max(MAX_ANSWER_TEXT),
              sources: z
                .array(z.object({ url: shortText, title: shortText }))
                .max(MAX_LIST),
            })
          )
          .optional(),
      })
    )
    .max(MAX_LIST),
  competitors: z
    .array(
      z.object({
        id: z.string().min(1),
        name: shortText,
        domain: shortText,
        shareOfVoice: fraction,
        mentionRate: fraction,
        winsOn: shortText,
      })
    )
    .max(MAX_LIST),
  perceptions: z
    .array(
      z.object({
        modelId: modelIdSchema,
        sentiment: z.enum(["positive", "neutral", "mixed", "negative"]),
        mentionRate: fraction,
        quote: shortText,
        claims: z
          .array(
            z.object({
              id: z.string().min(1),
              text: shortText,
              status: z.enum(["accurate", "outdated", "missing", "wrong"]),
            })
          )
          .max(MAX_LIST),
      })
    )
    .max(GEO_MODELS.length),
  opportunities: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: shortText,
        occupiedBy: z.array(z.string()).max(MAX_LIST),
        gap: shortText,
        action: shortText,
        channel: z.enum([
          "docs",
          "comparison-page",
          "listicle",
          "reddit",
          "github",
          "youtube",
          "changelog",
        ]),
      })
    )
    .max(MAX_LIST),
  sources: z
    .array(
      z.object({
        id: z.string().min(1),
        domain: shortText,
        name: shortText,
        share: fraction,
        brandPresent: z.boolean(),
      })
    )
    .max(MAX_LIST),
});

export const geoScanRequestSchema = z.object({
  modelId: modelIdSchema,
  prompt: z.string().min(3).max(MAX_TEXT),
  company: z.object({
    name: z.string().min(1).max(MAX_TEXT),
    domain: z.string().max(MAX_TEXT),
  }),
  competitors: z.array(z.string().max(MAX_TEXT)).max(MAX_LIST),
  siteText: z.string().max(MAX_SITE_TEXT).default(""),
});

const intentSchema = z.enum([
  "best-of",
  "comparison",
  "alternatives",
  "how-to",
  "pricing",
  "branded",
]);

const channelSchema = z.enum([
  "docs",
  "comparison-page",
  "listicle",
  "reddit",
  "github",
  "youtube",
  "changelog",
]);

export const geoScanExtractionSchema = z.object({
  rank: z
    .number()
    .int()
    .min(1)
    .max(MAX_RANK)
    .nullable()
    .describe(
      "1-based position of the company among the products the answer recommends or lists, or null if it is not mentioned"
    ),
  mentioned: z
    .array(z.string())
    .describe(
      "Every product or company the answer names, in order of appearance"
    ),
  sentiment: z.enum(["positive", "neutral", "mixed", "negative"]),
  quote: z
    .string()
    .describe(
      "One verbatim sentence from the answer about the company, or an empty string"
    ),
  intent: intentSchema.describe(
    "What the buyer is trying to do with this question"
  ),
  claims: z
    .array(
      z.object({
        text: z
          .string()
          .describe(
            "A short factual statement the answer makes about the company"
          ),
        status: z
          .enum(["accurate", "outdated", "missing", "wrong"])
          .describe(
            "Checked against the company's own website text: accurate if the site confirms it, wrong if the site contradicts it, outdated if the site shows it has changed, missing if the answer omits a capability the site clearly has"
          ),
      })
    )
    .describe("Claims the answer makes about the company, fact-checked"),
});

export const geoPromptsRequestSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(MAX_TEXT),
    domain: z.string().max(MAX_TEXT),
    category: z.string().max(MAX_TEXT),
  }),
  competitors: z.array(z.string().max(MAX_TEXT)).max(MAX_LIST),
  count: z.number().int().min(1).max(PROMPT_COUNT_MAX).default(12),
});

export const geoPromptsOutputSchema = z.object({
  prompts: z.array(
    z.object({
      text: z
        .string()
        .describe(
          "The question exactly as a buyer would type it into an AI assistant"
        ),
      intent: intentSchema,
    })
  ),
});

export const geoRecommendRequestSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(MAX_TEXT),
    domain: z.string().max(MAX_TEXT),
    category: z.string().max(MAX_TEXT),
  }),
  gaps: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().max(MAX_TEXT),
        heldBy: z.array(z.string().max(MAX_TEXT)).max(MAX_LIST),
        gap: z.string().max(MAX_TEXT),
      })
    )
    .max(MAX_LIST),
});

export const geoRecommendOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      action: z
        .string()
        .describe(
          "One specific piece of content to publish, in one or two sentences"
        ),
      channel: channelSchema,
    })
  ),
});

export const contextCompanyResponseSchema = z.object({
  target: z
    .object({
      companyName: z.string().optional(),
      field: z.string().optional(),
      fieldDescription: z.string().optional(),
    })
    .partial()
    .optional(),
  competitors: z.array(
    z.object({
      name: z.string(),
      domain: z.string(),
      description: z.string().optional().default(""),
      confidence: z.enum(["high", "medium"]).optional().default("medium"),
    })
  ),
});

export const geoSearchToolOutputSchema = z.object({
  results: z.array(
    z.object({ url: z.string(), title: z.string().optional().default("") })
  ),
});

const slugSchema = z.string().min(1).max(200);
const reportIdSchema = z.string().min(1).max(64);

export const geoSaveReportInputSchema = z.object({
  slug: slugSchema,
  id: reportIdSchema.nullable(),
  report: geoReportSchema,
  /** Set when the save follows a finished scan. */
  scannedAt: z.string().nullable().default(null),
});

export const geoDeleteReportInputSchema = z.object({
  slug: slugSchema,
  id: reportIdSchema,
});
