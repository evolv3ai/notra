/**
 * `full`: the plan includes GEO. `readOnly`: no GEO plan, but the workspace
 * already has GEO data (for example from the free scan), so it stays visible
 * while the API rejects writes. `locked`: no GEO plan and nothing to show.
 */
export type GeoAccessLevel = "full" | "readOnly" | "locked";
