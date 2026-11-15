import { z } from "zod";

export const chartThreadPageSchema = z.object({
  ok: z.literal(true),
  messages: z.array(
    z.object({
      files: z
        .array(
          z.object({ id: z.string().optional(), name: z.string().nullish() })
        )
        .optional(),
    })
  ),
  response_metadata: z
    .object({ next_cursor: z.string().optional() })
    .optional(),
});

export const chartFileInfoSchema = z.object({
  ok: z.literal(true),
  file: z.object({ name: z.string().min(1) }),
});

export const chartInputSchema = z
  .object({
    type: z.enum(["line", "bar"]),
    title: z.string().trim().min(1).max(100),
    source: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .describe("Data source and date range."),
    yAxisLabel: z.string().trim().max(40),
    labels: z.array(z.string().trim().min(1).max(40)).min(1).max(120),
    series: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(40),
          values: z
            .array(
              z
                .number()
                .finite()
                .min(-Number.MAX_SAFE_INTEGER)
                .max(Number.MAX_SAFE_INTEGER)
                .nullable()
            )
            .min(1)
            .max(120),
        })
      )
      .min(1)
      .max(6),
  })
  .superRefine((chart, ctx) => {
    for (const [index, series] of chart.series.entries()) {
      if (series.values.length !== chart.labels.length) {
        ctx.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message:
            "Each series needs one value per label; use null for missing data.",
        });
      }
    }
    if (
      !chart.series.some((series) =>
        series.values.some((value) => value !== null)
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["series"],
        message: "At least one measured value is required.",
      });
    }
  });
