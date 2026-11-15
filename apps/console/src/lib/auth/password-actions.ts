"use server";

import {
  signInWithPasswordInputSchema,
  verifyEmailCodeInputSchema,
} from "@notra/schemas/dashboard/auth/credentials";
import { verifyMfaCodeInputSchema } from "@notra/schemas/dashboard/auth/mfa";
import type {
  AuthFlowResult,
  SignInWithPasswordInput,
  VerifyEmailCodeInput,
  VerifyMfaCodeInput,
} from "@notra/schemas/types/dashboard/auth";
import { getWorkOS } from "@workos-inc/authkit-nextjs";

import {
  limitConsoleSignIn,
  limitPendingConsoleSignIn,
  runConsoleAuth,
} from "@/lib/auth/flow";
import type { ConsolePendingAuthContext } from "@/types/auth";

export async function signInWithPasswordAction(
  rawInput: SignInWithPasswordInput
): Promise<AuthFlowResult> {
  const parsed = signInWithPasswordInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address and password.",
    };
  }
  const input = parsed.data;
  try {
    await limitConsoleSignIn(input.email);
  } catch {
    return {
      status: "error",
      message:
        "Too many attempts or sign-in unavailable. Please try again shortly.",
    };
  }
  return runConsoleAuth(
    () =>
      getWorkOS().userManagement.authenticateWithPassword({
        clientId: process.env.WORKOS_CLIENT_ID ?? "",
        email: input.email,
        password: input.password,
      }),
    input.email,
    input.returnTo
  );
}

export async function verifyEmailCodeAction(
  rawInput: VerifyEmailCodeInput
): Promise<AuthFlowResult> {
  const parsed = verifyEmailCodeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "error", message: "Enter the 6-digit verification code." };
  }
  const input = parsed.data;
  let context: ConsolePendingAuthContext | null;
  try {
    context = await limitPendingConsoleSignIn(input.pendingAuthenticationToken);
  } catch {
    return {
      status: "error",
      message:
        "Too many attempts or sign-in unavailable. Please try again shortly.",
    };
  }
  if (!context) {
    return {
      status: "error",
      message: "Sign-in session has expired. Please sign in again.",
    };
  }
  return runConsoleAuth(
    () =>
      getWorkOS().userManagement.authenticateWithEmailVerification({
        clientId: process.env.WORKOS_CLIENT_ID ?? "",
        code: input.code,
        pendingAuthenticationToken: input.pendingAuthenticationToken,
      }),
    context.email,
    input.returnTo,
    context.identifier
  );
}

export async function verifyMfaCodeAction(
  rawInput: VerifyMfaCodeInput
): Promise<AuthFlowResult> {
  const parsed = verifyMfaCodeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the 6-digit authenticator code.",
    };
  }
  const input = parsed.data;
  let context: ConsolePendingAuthContext | null;
  try {
    context = await limitPendingConsoleSignIn(input.pendingAuthenticationToken);
  } catch {
    return {
      status: "error",
      message:
        "Too many attempts or sign-in unavailable. Please try again shortly.",
    };
  }
  if (!context) {
    return {
      status: "error",
      message: "Sign-in session has expired. Please sign in again.",
    };
  }
  return runConsoleAuth(
    () =>
      getWorkOS().userManagement.authenticateWithTotp({
        clientId: process.env.WORKOS_CLIENT_ID ?? "",
        code: input.code,
        pendingAuthenticationToken: input.pendingAuthenticationToken,
        authenticationChallengeId: input.authenticationChallengeId,
      }),
    context.email,
    input.returnTo,
    context.identifier
  );
}
