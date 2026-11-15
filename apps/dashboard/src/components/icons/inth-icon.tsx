import type { SVGProps } from "react";

export function InthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect fill="#ffc803" height="800" width="800" />
      <g
        fill="#192c37"
        transform="translate(400 400) scale(0.82) translate(-306 -342)"
      >
        <path
          d="M241.392 44.444v57.392h-91.827v128.696h91.827v57.39H0v-57.39h91.826V101.836H0V44.444zM458.048 184.211V44.444h54.996v243.478h-39.997L339.055 147.356v140.566h-54.996V44.444h40.997z"
          transform="translate(0 -44)"
        />
        <path
          d="M1166.67 333.333H624.306L555.556 400V0h611.114zM598.305 45.063v57.739h90.434v186.087h57.392V102.802h91.13v-57.74zm284.058.347V288.89h57.392v-89.972h114.085v89.972h57.74V45.41h-57.74v96.116H939.755V45.41z"
          fillRule="evenodd"
          transform="translate(-555 284)"
        />
      </g>
    </svg>
  );
}
