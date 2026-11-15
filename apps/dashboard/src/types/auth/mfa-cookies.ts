export interface MfaAttempt {
  workosUserId: string;
  authenticationChallengeId: string;
  startedAt: number;
}

interface PendingMfaChallenge {
  kind: "challenge";
  pendingAuthenticationToken: string;
  authenticationChallengeId: string;
  email: string;
}

interface PendingMfaEnrollment {
  kind: "enrollment";
  pendingAuthenticationToken: string;
  workosUserId: string;
  email: string;
}

export type PendingMfaFlow = PendingMfaChallenge | PendingMfaEnrollment;

export interface TotpEnrollmentInProgress {
  localUserId: string;
  factorId: string;
  authenticationChallengeId: string;
}
