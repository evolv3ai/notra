interface NotFoundDitherHoverConfig {
  offsetRange: number;
  lerp: number;
  visibleYRatio: number;
}

export interface NotFoundLink {
  label: string;
  href: string;
}

export interface NotFoundDitheringConfig {
  speed: number;
  shape: "wave";
  type: "4x4";
  size: number;
  scale: number;
  colorBack: string;
  colorFront: string;
  fit: "cover";
  hover: NotFoundDitherHoverConfig;
}
