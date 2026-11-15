import { sanitizeReturnTo } from "@notra/utils/auth-redirect";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { readPendingAuth } from "@/lib/auth/flow";
import { getServerSession } from "@/lib/auth/session";

const ERROR_MESSAGES: Record<string, string> = {
  "social-sign-in-failed": "Social sign-in failed. Please try again.",
  banned: "Your account has been suspended.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getServerSession();

  if (user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;

  const readParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return typeof value === "string" ? value : undefined;
  };

  const returnTo = sanitizeReturnTo(readParam("returnTo") ?? null) ?? undefined;
  const errorKey = readParam("error");

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="mx-auto w-full max-w-md rounded-md p-6 lg:px-8 lg:py-10">
        <LoginForm
          initialPending={await readPendingAuth()}
          initialError={
            errorKey && Object.hasOwn(ERROR_MESSAGES, errorKey)
              ? ERROR_MESSAGES[errorKey]
              : undefined
          }
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
