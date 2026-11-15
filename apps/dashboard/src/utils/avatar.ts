import { Avatar, Style } from "@dicebear/core";
import glassStyle from "@dicebear/styles/glass.json";

import {
  DICEBEAR_API_HOSTNAME,
  ORGANIZATION_AVATAR_BACKGROUND_FILL,
} from "@/constants/avatar";

const avatarStyle = new Style(glassStyle);

export function avatarDataUri(seed: string, backgroundFill?: boolean): string {
  return new Avatar(avatarStyle, {
    seed,
    ...(backgroundFill && {
      backgroundColorFill: [...ORGANIZATION_AVATAR_BACKGROUND_FILL],
    }),
  }).toDataUri();
}

export function getUserAvatarUrl(
  image: string | null | undefined,
  seed: string
): string {
  return image ?? avatarDataUri(seed);
}

export function resolveOrganizationLogo(
  logo: string | null | undefined
): string | undefined {
  if (!logo) {
    return undefined;
  }
  const url = URL.canParse(logo) ? new URL(logo) : null;
  if (url?.hostname !== DICEBEAR_API_HOSTNAME) {
    return logo;
  }
  return avatarDataUri(
    url.searchParams.get("seed") ?? "",
    url.searchParams.has("backgroundType")
  );
}
