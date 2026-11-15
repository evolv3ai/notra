import {
  FIRST_PARTY_DOMAIN,
  LOGO_LINK_BASE_URL,
  LOGO_LINK_CLIENT_ID,
  WWW_PREFIX_PATTERN,
} from "@/constants/logo-link";

function getOutboundLinkDomain(href?: string) {
  const url = href && URL.canParse(href) ? new URL(href) : null;
  if (!url?.protocol.startsWith("http")) {
    return null;
  }
  const hostname = url.hostname.replace(WWW_PREFIX_PATTERN, "");
  const isFirstParty =
    hostname === FIRST_PARTY_DOMAIN ||
    hostname.endsWith(`.${FIRST_PARTY_DOMAIN}`);
  return isFirstParty ? null : hostname;
}

export function getLogoLinkUrl(href?: string) {
  const domain = getOutboundLinkDomain(href);
  if (!(domain && LOGO_LINK_CLIENT_ID)) {
    return null;
  }
  const params = new URLSearchParams({
    publicClientId: LOGO_LINK_CLIENT_ID,
    domain,
    type: "icon",
  });
  return `${LOGO_LINK_BASE_URL}?${params}`;
}
