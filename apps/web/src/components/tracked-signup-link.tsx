import type { ComponentProps, MouseEvent } from "react";

import { AUTH_SIGNUP_URL } from "@/constants/auth";
import {
  signupDestination,
  trackedSignupHref,
  trackSignupStarted,
} from "@/utils/signup";

type TrackedSignupLinkProps = Omit<ComponentProps<"a">, "href"> & {
  children?: React.ReactNode;
  href?: string;
  source: string;
};

export function TrackedSignupLink({
  children,
  href = AUTH_SIGNUP_URL,
  onClick,
  onMouseDown,
  source,
  ...props
}: TrackedSignupLinkProps) {
  const trackedHref = trackedSignupHref(source, href);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    event.currentTarget.href = trackSignupStarted(source, href);
  }

  function handleMouseDown(event: MouseEvent<HTMLAnchorElement>) {
    onMouseDown?.(event);
    event.currentTarget.href = signupDestination(source, href);
  }

  return (
    <a
      href={trackedHref}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {children}
    </a>
  );
}
