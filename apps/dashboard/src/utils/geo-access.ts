import type { GeoAccessLevel } from "@/types/geo-access";

export function toGeoAccessLevel(
  entitled: boolean,
  hasData: boolean
): GeoAccessLevel {
  if (entitled) {
    return "full";
  }
  return hasData ? "readOnly" : "locked";
}
