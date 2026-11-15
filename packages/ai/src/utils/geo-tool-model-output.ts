type Row = Record<string, unknown>;

interface CompactTable {
  columns: string[];
  rows?: unknown[][];
  group_by?: string;
  groups?: Record<string, unknown[][]>;
  constant?: Row;
  same_as?: Record<string, string>;
}

// Below this, hoisting values saves too little to be worth a less obvious shape.
const MIN_COMPACT_ROWS = 4;
// A column is grouped only when each value repeats on average this often.
const MIN_GROUP_REPEAT = 3;
const INTEGER_KEY = /^(?:0|[1-9]\d*)$/;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniformColumns(records: unknown[]): string[] | null {
  const first = records[0];
  if (!isRow(first)) {
    return null;
  }
  const columns = Object.keys(first);
  if (columns.length === 0) {
    return null;
  }
  const uniform = records.every(
    (record) =>
      isRow(record) &&
      Object.keys(record).length === columns.length &&
      columns.every(
        (column) =>
          Object.hasOwn(record, column) && record[column] !== undefined
      )
  );
  return uniform ? columns : null;
}

function pickGroupColumn(rows: Row[], columns: string[]): string | undefined {
  let best: { column: string; saved: number } | undefined;
  for (const column of columns) {
    const values = rows.map((row) => row[column]);
    if (!values.every((value) => typeof value === "string")) {
      continue;
    }
    const unique = new Set(values as string[]);
    // Integer-like keys would be reordered by the object, scrambling groups.
    if (
      unique.size * MIN_GROUP_REPEAT > rows.length ||
      [...unique].some((value) => INTEGER_KEY.test(value))
    ) {
      continue;
    }
    const saved = (values as string[]).reduce(
      (total, value) => total + value.length,
      0
    );
    if (!best || saved > best.saved) {
      best = { column, saved };
    }
  }
  return best?.column;
}

/**
 * Lossless table form for uniform records: values shared by every row move
 * to `constant`, columns repeating another column move to `same_as`, and rows
 * that share a long label are grouped under it. GEO trends repeat the engine
 * name and identical rate columns on every daily row, which made the series
 * the largest item in the chat context.
 */
export function compactRecords(records: unknown[]): CompactTable | null {
  const columns = uniformColumns(records);
  if (!columns) {
    return null;
  }
  const rows = records as Row[];
  if (rows.length < MIN_COMPACT_ROWS) {
    return {
      columns,
      rows: rows.map((row) => columns.map((column) => row[column])),
    };
  }

  const constant: Row = {};
  const sameAs: Record<string, string> = {};
  const kept: string[] = [];
  for (const column of columns) {
    const firstValue = rows[0]?.[column];
    if (rows.every((row) => Object.is(row[column], firstValue))) {
      constant[column] = firstValue;
      continue;
    }
    const twin = kept.find((other) =>
      rows.every((row) => Object.is(row[column], row[other]))
    );
    if (twin) {
      sameAs[column] = twin;
      continue;
    }
    kept.push(column);
  }

  const table: CompactTable = { columns: kept };
  const groupBy = pickGroupColumn(rows, kept);
  if (groupBy) {
    const rowColumns = kept.filter((column) => column !== groupBy);
    const groups: Record<string, unknown[][]> = {};
    for (const row of rows) {
      const key = row[groupBy] as string;
      groups[key] ??= [];
      groups[key].push(rowColumns.map((column) => row[column]));
    }
    table.columns = rowColumns;
    table.group_by = groupBy;
    table.groups = groups;
  } else {
    table.rows = rows.map((row) => kept.map((column) => row[column]));
  }
  if (Object.keys(constant).length > 0) {
    table.constant = constant;
  }
  if (Object.keys(sameAs).length > 0) {
    table.same_as = sameAs;
  }
  return table;
}

export function geoToolModelOutput(output: unknown) {
  let value = output;
  if (isRow(output) && "chart" in output) {
    const metrics: Row = { ...output };
    Reflect.deleteProperty(metrics, "chart");
    for (const [key, field] of Object.entries(metrics)) {
      if (!Array.isArray(field) || field.length === 0) {
        continue;
      }
      const table = compactRecords(field);
      if (table) {
        metrics[key] = table;
      }
    }
    value = metrics;
  }
  return { type: "text" as const, value: JSON.stringify(value) ?? "null" };
}
