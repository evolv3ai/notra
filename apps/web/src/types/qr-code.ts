import type { inferParserType } from "nuqs";

import type { qrCodeParsers } from "@/schemas/qr-code";

export type QrErrorLevel = "L" | "M" | "Q" | "H";

export type QrCodeState = inferParserType<typeof qrCodeParsers>;

export interface QrCodeLogo {
  name: string;
  src: string;
}

export interface QrLogoLoad {
  logo: QrCodeLogo | null;
  error: string | null;
}

export interface QrLogoFieldProps {
  upload: QrCodeLogo | null;
  logoUrl: string;
  logoError: string | null;
  onUpload: (logo: QrCodeLogo | null) => void;
  onLogoUrlChange: (value: string) => void;
}
