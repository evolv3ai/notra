import {
  createParser,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

import {
  QR_CODE_DEFAULT_BG,
  QR_CODE_DEFAULT_FG,
  QR_CODE_DEFAULT_MARGIN,
  QR_ERROR_LEVELS,
} from "@/constants/qr-code";

const HEX_COLOR_REGEX = /^#?([\da-f]{6})$/i;

const parseAsHexColor = createParser({
  parse: (value) => HEX_COLOR_REGEX.exec(value)?.[1]?.toLowerCase() ?? null,
  serialize: (value) => value,
});

export const qrCodeParsers = {
  text: parseAsString.withDefault(""),
  level: parseAsStringLiteral(
    QR_ERROR_LEVELS.map((level) => level.id)
  ).withDefault("M"),
  fg: parseAsHexColor.withDefault(QR_CODE_DEFAULT_FG),
  bg: parseAsHexColor.withDefault(QR_CODE_DEFAULT_BG),
  margin: parseAsInteger.withDefault(QR_CODE_DEFAULT_MARGIN),
  logo: parseAsString.withDefault(""),
};

export const serializeQrCode = createSerializer(qrCodeParsers);
