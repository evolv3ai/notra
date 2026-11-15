export function reservedSlugMessage(slug: string, domain: string): string {
  return `${slug} is reserved for ${domain}. Sign in with an @${domain} email address to use it, contact support, or pick another address.`;
}

/** Whether a dash-separated slug contains one of the words or phrases as whole words. */
export function slugContainsWord(
  slug: string,
  words: ReadonlySet<string>
): boolean {
  return [...words].some((word) => `-${slug}-`.includes(`-${word}-`));
}
