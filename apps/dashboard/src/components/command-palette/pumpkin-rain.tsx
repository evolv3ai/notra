import {
  PUMPKIN_PIXEL_SIZE,
  PUMPKIN_PIXELS,
  PUMPKIN_RAIN_DROPS,
} from "@/constants/command-palette";

export function PumpkinRain() {
  return PUMPKIN_RAIN_DROPS.map((drop, index) => (
    <svg
      className="absolute -top-12 motion-safe:animate-[pumpkin-rain_3s_linear_infinite_both]"
      height={drop.size}
      key={index}
      shapeRendering="crispEdges"
      style={{
        left: `${drop.left}%`,
        animationDelay: `${drop.delay}s`,
        animationDuration: `${drop.duration}s`,
      }}
      viewBox={`0 0 ${PUMPKIN_PIXEL_SIZE.width} ${PUMPKIN_PIXEL_SIZE.height}`}
      width={drop.size}
    >
      {PUMPKIN_PIXELS.map((pixel) => (
        <rect
          fill={pixel.fill}
          height={1}
          key={`${pixel.x}-${pixel.y}`}
          width={1}
          x={pixel.x}
          y={pixel.y}
        />
      ))}
    </svg>
  ));
}
