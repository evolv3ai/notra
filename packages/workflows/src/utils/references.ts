import {
  PATH_SEGMENT_PATTERN,
  REFERENCE_PATTERN,
  WHOLE_REFERENCE_PATTERN,
} from "../constants/references";
import type { WorkflowScope } from "../types/run";

function parseReferencePath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  for (const match of path.matchAll(PATH_SEGMENT_PATTERN)) {
    segments.push(match[1] === undefined ? match[0] : Number(match[1]));
  }
  return segments;
}

export function readPath(
  root: unknown,
  segments: (string | number)[]
): unknown {
  let current = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    if (!Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

export function parseReference(path: string): {
  root: keyof WorkflowScope;
  rest: (string | number)[];
  nodeId: string | null;
} | null {
  const [first, ...rest] = parseReferencePath(path);
  const root = first === "trigger" || first === "nodes" ? first : null;
  if (!root) {
    return null;
  }
  const [nodeId] = rest;
  return {
    root,
    rest,
    nodeId: root === "nodes" && typeof nodeId === "string" ? nodeId : null,
  };
}

function readReference(path: string, scope: WorkflowScope): unknown {
  const reference = parseReference(path);
  return reference
    ? readPath(scope[reference.root], reference.rest)
    : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function stringify(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function resolveReferences(
  value: unknown,
  scope: WorkflowScope
): unknown {
  if (typeof value === "string") {
    const whole = WHOLE_REFERENCE_PATTERN.exec(value);
    if (whole?.[1]) {
      return readReference(whole[1], scope);
    }
    return value.replace(REFERENCE_PATTERN, (_, path: string) =>
      stringify(readReference(path, scope))
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveReferences(item, scope));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveReferences(item, scope),
      ])
    );
  }
  return value;
}

export function collectReferences(value: unknown): string[] {
  if (typeof value === "string") {
    return [...value.matchAll(REFERENCE_PATTERN)].flatMap((match) =>
      match[1] ? [match[1]] : []
    );
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectReferences);
  }
  if (isPlainObject(value)) {
    return Object.values(value).flatMap(collectReferences);
  }
  return [];
}

export function hasReferences(value: unknown) {
  return collectReferences(value).length > 0;
}

export function unresolvedReferences(
  value: unknown,
  scope: WorkflowScope
): string[] {
  return collectReferences(value).filter(
    (path) => readReference(path, scope) === undefined
  );
}
