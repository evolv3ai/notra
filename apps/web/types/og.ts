import type satori from "satori";
import type { Font } from "satori";

export type ImageResponseOptions = Parameters<typeof satori>[1];

export type OgAdditionalAsset = string | Font[];

export interface OgFallbackFamily {
  code: string;
  name: string;
}
