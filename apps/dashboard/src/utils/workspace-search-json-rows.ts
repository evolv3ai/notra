import {
  sql,
  type AnyColumn,
  type InferColumnsDataTypes,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

export function workspaceSearchJsonRows<T extends Record<string, AnyColumn>>(
  query: SQLWrapper | null,
  columns: T
): SQL<InferColumnsDataTypes<T>[]> {
  if (!query) {
    return sql<InferColumnsDataTypes<T>[]>`'[]'::json`;
  }
  const entries = Object.entries(columns);
  const fields = entries.flatMap(([key, column]) => [
    sql`${key}::text`,
    sql`${sql.identifier("search_rows")}.${sql.identifier(column.name)}`,
  ]);
  return sql`(select coalesce(json_agg(json_build_object(${sql.join(fields, sql`, `)})), '[]'::json) from (${query.getSQL()}) as search_rows)`.mapWith(
    (rows: Record<string, unknown>[]) =>
      rows.map(
        (row) =>
          Object.fromEntries(
            entries.map(([key, column]) => [
              key,
              row[key] === null ? null : column.mapFromDriverValue(row[key]),
            ])
          ) as InferColumnsDataTypes<T>
      )
  );
}
