import {
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import { z } from "zod";

import { UTM_CHANNEL_PRESETS } from "@/constants/utm-builder";

const URL_SCHEME_REGEX = /^[a-z][a-z\d+.-]*:(?!\d)/i;
const HTTP_PROTOCOL_REGEX = /^https?$/;

export const utmDestinationSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) =>
    URL_SCHEME_REGEX.test(value) ? value : `https://${value}`
  )
  .pipe(z.url({ protocol: HTTP_PROTOCOL_REGEX }));

export const utmBuilderParsers = {
  url: parseAsString.withDefault(""),
  source: parseAsString.withDefault(""),
  medium: parseAsString.withDefault(""),
  campaign: parseAsString.withDefault(""),
  id: parseAsString.withDefault(""),
  term: parseAsString.withDefault(""),
  content: parseAsString.withDefault(""),
  platform: parseAsString.withDefault(""),
  format: parseAsString.withDefault(""),
  tactic: parseAsString.withDefault(""),
  channels: parseAsArrayOf(
    parseAsStringLiteral(UTM_CHANNEL_PRESETS.map((preset) => preset.id))
  ).withDefault([]),
  clean: parseAsBoolean.withDefault(true),
};

export const serializeUtmBuilder = createSerializer(utmBuilderParsers);
