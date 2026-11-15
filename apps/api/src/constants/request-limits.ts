// Sized for the largest valid body: a full competitor import (2,000 brands,
// eight 128-char synonyms each) stays under ~13 MB even with \u-escaped JSON.
// Bun's own default would accept 128 MB.
export const API_MAX_BODY_BYTES = 16 * 1024 * 1024;
