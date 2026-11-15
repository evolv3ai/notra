import {
  blogFrontmatterSchema,
  changelogFrontmatterSchema,
} from "@notra/sites-core/schemas/site-config";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import { parse as parseYaml } from "yaml";

import {
  FRONTMATTER_BLOCK,
  FRONTMATTER_EXAMPLES,
  YAML_KEY,
} from "./constants/frontmatter";
import type { SiteEntry } from "./types/entries";
import type { ParsedFrontmatter } from "./types/frontmatter";
import { closestName } from "./utils/closest-name";
import { errorSummary } from "./utils/errors";

function frontmatterError(
  path: string,
  code: string,
  message: string
): SiteDiagnostic {
  return { severity: "error", file: path, line: 1, code, message };
}

function keyLine(yaml: string, key: string): number {
  const index = yaml
    .split(/\r?\n/)
    .findIndex((line) => YAML_KEY.exec(line)?.[2] === key);
  return index === -1 ? 1 : index + 2;
}

export function parseEntryFrontmatter(
  path: string,
  area: SiteEntry["area"],
  source: string
): ParsedFrontmatter {
  const yaml = FRONTMATTER_BLOCK.exec(source)?.[1];
  if (yaml === undefined) {
    return {
      data: null,
      diagnostics: [
        frontmatterError(
          path,
          "frontmatter_missing",
          "Missing frontmatter. Start the file with ---, a title and a date, then ---."
        ),
      ],
    };
  }
  let raw: unknown;
  try {
    raw = parseYaml(yaml) ?? {};
  } catch (error) {
    return {
      data: null,
      diagnostics: [
        frontmatterError(
          path,
          "frontmatter_yaml",
          `Frontmatter is not valid YAML: ${errorSummary(error)}`
        ),
      ],
    };
  }
  const schema =
    area === "blog" ? blogFrontmatterSchema : changelogFrontmatterSchema;
  const known = Object.keys(schema.shape);
  const fields =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const warnings = Object.keys(fields)
    .filter((key) => !known.includes(key))
    .map((key): SiteDiagnostic => {
      const suggestion = closestName(key, known);
      return {
        severity: "warning",
        file: path,
        line: keyLine(yaml, key),
        code: "frontmatter_unknown_key",
        message: `Frontmatter key "${key}" is not supported in ${area} entries and is ignored.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
      };
    });
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { data: parsed.data, diagnostics: warnings };
  }
  return {
    data: null,
    diagnostics: [
      ...parsed.error.issues.map((issue) => {
        const [key] = issue.path;
        const example =
          typeof key === "string" && fields[key] === undefined
            ? FRONTMATTER_EXAMPLES[key]
            : undefined;
        return example
          ? frontmatterError(
              path,
              "frontmatter_invalid",
              `${path} is missing "${String(key)}" in its frontmatter. Add a line like ${example} between the --- lines.`
            )
          : frontmatterError(
              path,
              "frontmatter_invalid",
              `Frontmatter ${issue.path.join(".") || "value"}: ${issue.message}`
            );
      }),
      ...warnings,
    ],
  };
}
