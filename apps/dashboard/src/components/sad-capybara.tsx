import {
  SAD_CAPYBARA_COLORS,
  SAD_CAPYBARA_PIXELS,
} from "@/constants/sad-capybara";
import { cn } from "@/lib/utils";

const WIDTH = SAD_CAPYBARA_PIXELS[0].length;
const HEIGHT = SAD_CAPYBARA_PIXELS.length;

const PATHS = Object.entries(SAD_CAPYBARA_COLORS).map(([key, fill]) => ({
  fill,
  d: SAD_CAPYBARA_PIXELS.flatMap((row, y) =>
    [...row].flatMap((pixel, x) =>
      pixel === key ? [`M${x} ${y}h1v1h-1z`] : []
    )
  ).join(""),
}));

export function SadCapybara({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-auto w-24", className)}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {PATHS.map(({ fill, d }) => (
        <path d={d} fill={fill} key={fill} />
      ))}
    </svg>
  );
}
