import { GEO_OLOSTEP_ENGINES } from "../constants/geo-olostep";

export function isGeoOlostepEngine(engine: string): boolean {
  return engine in GEO_OLOSTEP_ENGINES;
}
