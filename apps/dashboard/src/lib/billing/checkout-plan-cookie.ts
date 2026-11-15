import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

import {
  CHECKOUT_PLAN_COOKIE,
  CHECKOUT_PLAN_COOKIE_MAX_AGE,
} from "@/constants/cookies";
import { checkoutPlanId } from "@/utils/billing-plans";

export function rememberCheckoutPlan(value: unknown) {
  const planId = checkoutPlanId(value);
  if (planId) {
    setCookie(CHECKOUT_PLAN_COOKIE, planId, {
      path: "/",
      maxAge: CHECKOUT_PLAN_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}

export function takeCheckoutPlan(): string | null {
  const planId = checkoutPlanId(getCookie(CHECKOUT_PLAN_COOKIE));
  if (planId) {
    deleteCookie(CHECKOUT_PLAN_COOKIE, { path: "/" });
  }
  return planId;
}
