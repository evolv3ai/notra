import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";

export function siteBranchLabel(
  name: string,
  locale: string,
  draftFrom: (date: string) => string,
  withTime = false
) {
  const content =
    /^notra\/(?:blog-post|changelog)-(.+?)-[a-f0-9]{16}(?:-[a-f0-9]{8})?$/.exec(
      name
    );
  if (content) {
    return content[1]!
      .replaceAll("-", " ")
      .replace(/^./, (letter) => letter.toUpperCase());
  }
  if (!name.startsWith(SITE_EDIT_BRANCH_PREFIX)) {
    return name;
  }
  const title = name.slice(SITE_EDIT_BRANCH_PREFIX.length);
  const timestamp =
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-[a-f0-9]+$/.exec(title);
  if (timestamp) {
    const [, year, month, day, hour, minute, second] = timestamp;
    const date = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    );
    if (!Number.isNaN(date.getTime())) {
      return draftFrom(
        new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
        }).format(date)
      );
    }
  }
  const label = title
    .replaceAll("-", " ")
    .replace(/\b(ui|ux|api|seo|ai|ci|cd)\b/gi, (word) => word.toUpperCase());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Labels for a branch list, adding the time where two drafts share a day. */
export function siteBranchLabels(
  entries: readonly { name: string; title?: string }[],
  locale: string,
  draftFrom: (date: string) => string
) {
  const labels = new Map(
    entries.map((entry) => [
      entry.name,
      entry.title ?? siteBranchLabel(entry.name, locale, draftFrom),
    ])
  );
  const counts = new Map<string, number>();
  for (const label of labels.values()) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  for (const entry of entries) {
    const label = labels.get(entry.name);
    if (!entry.title && label && (counts.get(label) ?? 0) > 1) {
      labels.set(
        entry.name,
        siteBranchLabel(entry.name, locale, draftFrom, true)
      );
    }
  }
  return labels;
}
