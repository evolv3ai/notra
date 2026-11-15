import { cn } from "cn";

import type { ChatgptAppCallProps } from "../types/chatgpt";

export const ChatgptAppCall = ({
  className,
  label = "Used",
  logo,
  name,
  ...props
}: ChatgptAppCallProps) => (
  <div
    className={cn(
      "font-chatgpt text-chatgpt-muted flex items-center gap-2 text-base leading-7",
      className
    )}
    data-slot="chatgpt-app-call"
    {...props}
  >
    {logo && (
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md [&_img]:size-full [&_svg]:size-full">
        {logo}
      </span>
    )}
    <span>
      {label} <span className="text-chatgpt-fg font-medium">{name}</span>
    </span>
  </div>
);
