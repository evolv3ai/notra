import type { SiteDiagnostic } from "@notra/sites-core/types/build";

import {
  COLLAPSED_WARNING_CODES,
  COLLAPSED_WARNING_EXAMPLES,
} from "../constants/validate";

export function hasErrors(diagnostics: readonly SiteDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function location(diagnostic: SiteDiagnostic): string {
  return diagnostic.line
    ? `${diagnostic.file}:${diagnostic.line}`
    : String(diagnostic.file);
}

export function collapseRepeatedWarnings(
  diagnostics: readonly SiteDiagnostic[]
): SiteDiagnostic[] {
  const groups = new Map<string, SiteDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (COLLAPSED_WARNING_CODES.has(diagnostic.code)) {
      const key = `${diagnostic.code}\0${diagnostic.message}`;
      const group = groups.get(key);
      if (group) {
        group.push(diagnostic);
      } else {
        groups.set(key, [diagnostic]);
      }
    }
  }
  return diagnostics.flatMap((diagnostic) => {
    const group = groups.get(`${diagnostic.code}\0${diagnostic.message}`);
    if (!group) {
      return [diagnostic];
    }
    if (group[0] !== diagnostic) {
      return [];
    }
    const rest = group.slice(1);
    if (rest.length === 0) {
      return [diagnostic];
    }
    const examples = rest
      .slice(0, COLLAPSED_WARNING_EXAMPLES)
      .map(location)
      .join(", ");
    const more = rest.length > COLLAPSED_WARNING_EXAMPLES ? ", …" : "";
    return [
      {
        ...diagnostic,
        message: `${diagnostic.message} Also in ${rest.length} more place${rest.length === 1 ? "" : "s"}: ${examples}${more}.`,
      },
    ];
  });
}
