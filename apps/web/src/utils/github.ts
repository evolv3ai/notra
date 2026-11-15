import type { ContributorsData } from "~types/github";

import { CONTRIBUTORS_DATA } from "@/constants/contributors-data";

export function fetchContributorsData(): Promise<ContributorsData> {
  return Promise.resolve(CONTRIBUTORS_DATA);
}

const TRAILING_ZERO_DECIMAL = /\.0$/;

export function formatContributionCount(count: number): string {
  if (count >= 1000) {
    const thousands = count / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1).replace(TRAILING_ZERO_DECIMAL, "")}k`;
  }
  return count.toString();
}
