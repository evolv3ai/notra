import { cn as cnfast } from "cnfast";

import { ORGANIZATION_AVATAR_URL } from "@/constants/avatar";

export const cn = cnfast;

export function generateOrganizationAvatar(slug: string) {
  return `${ORGANIZATION_AVATAR_URL}?seed=${slug}&backgroundType=gradientLinear,solid`;
}

export function errorMessageOr(
  message: string | null | undefined,
  fallback: string
): string {
  return message || fallback;
}
