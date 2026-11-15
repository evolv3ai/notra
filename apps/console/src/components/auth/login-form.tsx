"use client";

import { loginSchema } from "@notra/schemas/dashboard/auth/credentials";
import { LoginForm as SharedLoginForm } from "@notra/ui/components/shared/auth/login-form";

import {
  signInWithPasswordAction,
  verifyEmailCodeAction,
  verifyMfaCodeAction,
} from "@/lib/auth/password-actions";
import { startSocialSignInAction } from "@/lib/auth/social-actions";
import type { ConsoleLoginFormProps } from "@/types/auth";

const validators = {
  email: (value: string) =>
    loginSchema.shape.email.safeParse(value).error?.issues[0]?.message,
  password: (value: string) =>
    loginSchema.shape.password.safeParse(value).error?.issues[0]?.message,
};

export function LoginForm(props: ConsoleLoginFormProps) {
  return (
    <SharedLoginForm
      {...props}
      title="Notra Console"
      description="Sign in to manage Notra."
      callbackPath="/dashboard"
      showSignupLink={false}
      showForgotPasswordLink={false}
      validators={validators}
      signInWithPassword={signInWithPasswordAction}
      startSocialSignIn={startSocialSignInAction}
      verifyEmailCode={verifyEmailCodeAction}
      verifyMfaCode={verifyMfaCodeAction}
    />
  );
}
