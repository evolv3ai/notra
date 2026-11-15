import type { ModalBackgroundLocation, RouteModal } from "@/types/route-modal";

export function modalNavigationOptions(
  location: ModalBackgroundLocation,
  href: string
) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return;
  }
  const destination = new URL(href, "http://localhost");
  const match = destination.pathname.match(
    /^\/([^/]+)\/(analytics\/accounts\/([^/]+)|integrations\/(framer|raycast))\/?$/
  );
  if (!match || destination.pathname === location.pathname) {
    return;
  }
  const organizationSlug = match[1];
  const section = match[2]?.split("/")[0];
  const prefix = `/${organizationSlug}/${section}`;
  if (
    !organizationSlug ||
    !(
      location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
    )
  ) {
    return;
  }
  let name: string;
  try {
    name = decodeURIComponent(match[3] ?? "");
  } catch {
    return;
  }
  let kind: RouteModal["kind"];
  if (match[3]) {
    kind = "account";
  } else {
    kind = match[4] === "framer" ? "framer" : "raycast";
  }
  return {
    to: location.pathname,
    search: location.search,
    hash: location.hash,
    state: { notraModal: { kind, organizationSlug, name } },
    resetScroll: false,
    hashScrollIntoView: false,
    mask: {
      to: destination.pathname,
      search: Object.fromEntries(destination.searchParams),
      hash: destination.hash.slice(1),
      unmaskOnReload: true,
    },
  };
}
