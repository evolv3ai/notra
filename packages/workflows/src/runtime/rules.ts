import type { WorkflowRule } from "../types/graph";

function isEqual(left: unknown, right: unknown) {
  if (left === right) {
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return Number.NaN;
}

function compare(
  subject: unknown,
  value: unknown,
  test: (left: number, right: number) => boolean
) {
  const left = toNumber(subject);
  const right = toNumber(value);
  return Number.isFinite(left) && Number.isFinite(right) && test(left, right);
}

export function evaluateRule(rule: WorkflowRule): boolean {
  const { subject, value } = rule;
  switch (rule.operator) {
    case "exists":
      return subject !== undefined && subject !== null && subject !== "";
    case "equals":
      return isEqual(subject, value);
    case "not_equals":
      return !isEqual(subject, value);
    case "gt":
      return compare(subject, value, (left, right) => left > right);
    case "gte":
      return compare(subject, value, (left, right) => left >= right);
    case "lt":
      return compare(subject, value, (left, right) => left < right);
    case "lte":
      return compare(subject, value, (left, right) => left <= right);
    case "contains":
      if (typeof subject === "string") {
        return typeof value === "string" && subject.includes(value);
      }
      return (
        Array.isArray(subject) && subject.some((item) => isEqual(item, value))
      );
    case "in":
      return (
        Array.isArray(value) && value.some((item) => isEqual(subject, item))
      );
    default:
      return false;
  }
}
