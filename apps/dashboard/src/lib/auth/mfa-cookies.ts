import "zod/compile";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  MFA_ATTEMPT_COOKIE,
  MFA_COOKIE_MAX_AGE_SECONDS,
  MFA_PENDING_COOKIE_PREFIX,
  TOTP_ENROLLMENT_COOKIE,
} from "@/constants/security";
import {
  clearSignedCookie,
  clearSignedCookiesWithPrefix,
  readSignedCookie,
  storeSignedCookie,
} from "@/lib/auth/signed-cookie";
import type {
  MfaAttempt,
  PendingMfaFlow,
  TotpEnrollmentInProgress,
} from "@/types/auth/mfa-cookies";

const mfaAttemptSchema = z.object({
  workosUserId: z.string().min(1),
  authenticationChallengeId: z.string().min(1),
  startedAt: z.number().int().positive(),
});

const issuedAtSchema = z.object({ issuedAt: z.number().int().positive() });

const pendingMfaFlowSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("challenge"),
    pendingAuthenticationToken: z.string().min(1),
    authenticationChallengeId: z.string().min(1),
    email: z.string(),
  }),
  z.object({
    kind: z.literal("enrollment"),
    pendingAuthenticationToken: z.string().min(1),
    workosUserId: z.string().min(1),
    email: z.string(),
  }),
]);

const totpEnrollmentInProgressSchema = z.object({
  localUserId: z.string().min(1),
  factorId: z.string().min(1),
  authenticationChallengeId: z.string().min(1),
});

/**
 * Browser cookie expiry is advisory: a copied cookie stays validly signed
 * forever, so every MFA cookie is also aged on the server.
 */
function isFresh(issuedAt: number) {
  const age = Date.now() - issuedAt;
  return age >= 0 && age <= MFA_COOKIE_MAX_AGE_SECONDS * 1000;
}

async function readFreshSignedCookie<T>(
  name: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const value = await readSignedCookie(name, issuedAtSchema.and(schema));
  return value && isFresh(value.issuedAt) ? value : null;
}

function storeFreshSignedCookie(name: string, payload: object) {
  return storeSignedCookie(
    name,
    { ...payload, issuedAt: Date.now() },
    MFA_COOKIE_MAX_AGE_SECONDS
  );
}

const mfaFlowIdSchema = z.uuid();

function getPendingMfaCookieName(flowId: string) {
  const parsed = mfaFlowIdSchema.safeParse(flowId);
  return parsed.success ? `${MFA_PENDING_COOKIE_PREFIX}_${parsed.data}` : null;
}

export function storeMfaAttempt(attempt: MfaAttempt) {
  return storeSignedCookie(
    MFA_ATTEMPT_COOKIE,
    attempt,
    MFA_COOKIE_MAX_AGE_SECONDS
  );
}

export async function readMfaAttempt() {
  const attempt = await readSignedCookie(MFA_ATTEMPT_COOKIE, mfaAttemptSchema);
  return attempt && isFresh(attempt.startedAt) ? attempt : null;
}

export function clearMfaAttemptCookie() {
  return clearSignedCookie(MFA_ATTEMPT_COOKIE);
}

export async function storePendingMfaFlow(flow: PendingMfaFlow) {
  const flowId = crypto.randomUUID();
  await storeFreshSignedCookie(`${MFA_PENDING_COOKIE_PREFIX}_${flowId}`, flow);
  return flowId;
}

export function readPendingMfaFlow(flowId: string) {
  const cookieName = getPendingMfaCookieName(flowId);
  return cookieName
    ? readFreshSignedCookie(cookieName, pendingMfaFlowSchema)
    : Promise.resolve(null);
}

export function clearAllPendingMfaFlows() {
  return clearSignedCookiesWithPrefix(`${MFA_PENDING_COOKIE_PREFIX}_`);
}

export async function clearPendingMfaFlow(flowId: string) {
  const cookieName = getPendingMfaCookieName(flowId);
  if (cookieName) {
    await clearSignedCookie(cookieName);
  }
}

export function storeTotpEnrollmentInProgress(
  enrollment: TotpEnrollmentInProgress
) {
  return storeFreshSignedCookie(TOTP_ENROLLMENT_COOKIE, enrollment);
}

export function readTotpEnrollmentInProgress() {
  return readFreshSignedCookie(
    TOTP_ENROLLMENT_COOKIE,
    totpEnrollmentInProgressSchema
  );
}

export function clearTotpEnrollmentInProgress() {
  return clearSignedCookie(TOTP_ENROLLMENT_COOKIE);
}
