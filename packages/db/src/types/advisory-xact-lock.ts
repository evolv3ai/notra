export interface AdvisoryXactLockOptions {
  /** Return false instead of waiting when another transaction holds the lock. */
  try?: boolean;
  /** Take the shared lock, which only conflicts with exclusive holders. */
  shared?: boolean;
}
