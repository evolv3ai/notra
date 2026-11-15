# Font optimization audit

Measured on 2026-10-30. The baseline is the original font setup at `012c060`,
with the same content as this change. The implementation changes no content,
fallback family, synthesis setting or `font-display` value.

[`inventory.json`](./inventory.json) contains each input/output file's SHA-256,
size, glyph count, cmap, effective CSS range, variable axes, GSUB/GPOS features,
hint tables and number of glyphs containing hint instructions.
[`measurements.json`](./measurements.json) contains page requests, preloads,
computed font settings, platform-font evidence and raw pixel-diff statistics.
See [README.md](./README.md) for the manual regeneration and verification commands.

## Font bytes

These are compressed WOFF2 file bytes, not the sum downloaded by every page.

| Original file/group | Before | Shipped file | After | Glyphs before → after |
| --- | ---: | --- | ---: | ---: |
| Inter Cyrillic Extended | 25,960 | Removed: no retained coverage | 0 | 224 → 0 |
| Inter Cyrillic | 18,748 | `inter-cyrillic-extended.woff2` | 1,624 | 153 → 10 |
| Inter Greek Extended | 11,232 | Removed: no retained coverage | 0 | 263 → 0 |
| Inter Greek | 18,996 | `inter-greek-extended.woff2` | 2,040 | 144 → 10 |
| Inter Vietnamese | 10,252 | `inter-vietnamese-extended.woff2` | 4,108 | 152 → 36 |
| Inter Latin Extended | 85,068 | `inter-extended.woff2` | 16,072 | 879 → 205 |
| Inter Latin | 48,256 | `inter-core.woff2` | 40,892 | 518 → 419 |
| Instrument Serif Latin Extended | 11,604 | `instrument-extended.woff2` | 6,964 | 172 → 156 |
| Instrument Serif Latin | 21,032 | `instrument-core.woff2` | 14,512 | 220 → 215 |
| Satoshi Variable | 42,588 | Original, unchanged | 42,588 | 504 → 504 |
| **Total CSS-font WOFF2 catalog** | **293,736** | | **128,800** | |

Inter totals **218,512 → 64,736 B**. Instrument Serif totals
**32,636 → 21,476 B**. The combined catalog saves **164,936 B (56.2%)**;
the page-specific savings below are smaller because browsers did not download
unused original language subsets.

Instrument Serif keeps both original formats. Its legacy WOFF payload totals
**28,196 → 26,452 B**: core **18,336 → 17,712 B** and extended
**9,860 → 8,740 B**. The legacy pair saves 1,744 B; preserving that fallback costs modern WOFF2
browsers zero requests or bytes.

Separate pipelines remain unchanged and are fully inventoried:

- Remotion's public Inter 400/600/700/800 assets: **96,872 B** combined. Their
  weights include 800, which is not a CSS-body-font requirement. Changing them
  would also require video-frame regression proof.
- Server-side OG Inter 400/500/600 WOFF inputs: **93,240 B** combined. They are
  embedded in the image renderer, not fetched as page web fonts. `/marketing/chat`
  is a PNG endpoint, not a normal HTML font consumer.
- `apps/ui`'s Google Sans Flex belongs to a separate application and is not a
  font face loaded by the public website. The report skin's Google Sans names
  continue to use their existing system fallbacks.

## Cold page requests and preloads

Fresh browser contexts, complete page scroll, fonts ready, no warm font cache.
Bytes are font response bodies; HTTP headers and non-font assets are excluded.
All baseline pages below preload **no fonts**. No generated font is embedded
into global CSS; the verifier rejects font data URLs.

| Page | Before | After | Saved | Font preloads after |
| --- | ---: | ---: | ---: | --- |
| `/` | 90,844 | 83,480 | 7,364 | Inter core |
| `/brand` | 111,876 | 97,992 | 13,884 | Inter core, Instrument core |
| `/features/conversations` | 90,844 | 83,480 | 7,364 | Inter core |
| `/integrations/github` | 90,844 | 83,480 | 7,364 | Inter core |
| `/blog/how-to-build-a-muse-connector` | 90,844 | 83,480 | 7,364 | Inter core |
| `/state-of-ai-search/email-api/2026-10` | 90,844 | 83,480 | 7,364 | Inter core |
| `/state-of-ai-search/changelog/2026-10` | 90,844 | 83,480 | 7,364 | Inter core |

These are measured representative pages, not an assertion that every sitemap
URL was crawled. The root document preloads Inter for HTML routes; `/brand`
additionally preloads Instrument Serif. Handler-generated images, Markdown and
JSON do not render that document. Preloads use `as="font"`, `font/woff2` and
anonymous CORS. Satoshi still loads through its original CSS face.

Fresh-context repertoire probes show:

| Text/family | Before | After | Extended requested after? |
| --- | ---: | ---: | --- |
| ASCII and common punctuation / Inter | 48,256 | 40,892 | No |
| Latin-1 accents / Inter | 48,256 | 40,892 | No |
| `Té ÅV café Łódź` / Inter | 133,324 | 56,964 | Latin Extended-A only |
| ASCII plus CJK / Inter | 48,256 | 40,892 | No |
| ASCII and common punctuation / Instrument Serif | 21,032 | 14,512 | No |
| Latin-1 accents / Instrument Serif | 21,032 | 14,512 | No |
| `Té ÅV café Łódź` / Instrument Serif | 32,636 | 21,476 | Latin Extended-A only |
| ASCII plus CJK / Instrument Serif | 21,032 | 14,512 | No |

CDP identifies `Noto Sans CJK JP` as a system font for the CJK glyphs before and
after. The new custom faces are internally named `Notra Text` and `Notra Accent`.
The three smaller Inter extended files are external assets, not Vite-inlined
payloads hidden in CSS.

## Usage and shaping policy

The corpus includes website code/content, imported shared styles and reachable
UI sources. It is a conservative superset of rendered text, including source
strings and comments. Supported Latin-1 and Latin Extended-A plus canonical
decompositions stay available. Existing missing glyphs are not invented.

Actual Inter requirements are 300–700, including the GitHub card's one-off 300,
Markdown/shared-component bold and synthetic italic/bold-italic text. Satoshi
uses 400/500/600 in the audited marketing components; its file remains intact.
Instrument Serif was imported only at 400 normal, so its existing synthetic
styles remain. The actual Inter import has only `wght`; package metadata also
advertises an `opsz` variant that the site did not import.

Keep `tnum` for shared tables, reports and the Satoshi calculator. Keep default
`calt`, `ccmp`, `locl`, `liga` where present, kerning and mark positioning.
Unused Inter `dnom`, `frac`, `numr` and `pnum` features are removed. Satoshi's
feature set cannot be modified under its license. The full before/after feature
lists, including each language face, are in the inventory.

Inline SVG `Inter, sans-serif`, JetBrains Mono requests and the consent theme
were checked, rather than assuming every element uses the body family. The
unregistered `Inter` alias is deliberately not made into a new web-font alias.
Normal system monospace/serif text and `font-synthesis:none` components remain
as before. Shared AI Overview CSS uses Google Sans/Google Sans Flex/Roboto/Arial,
not the website's Inter Variable face.

No source stylesheet enables automatic hyphenation today. The tool still
requests U+2010, and the specimen includes it, soft hyphens and `hyphens:auto`.
The original OFL cmaps do not encode U+2010 or U+00AD, so generated ranges do not
falsely claim them; their original fallback behavior is preserved.

Inter originally has `prep` and `gasp` tables but zero hinted glyphs. Instrument
Serif WOFF2 originally has `fpgm`, `prep`, `cvt ` and `gasp`, with 176 hinted
Latin glyphs and 107 hinted extended glyphs. All generated faces have zero
glyph hint instructions and no `prep`, `fpgm` or `cvt ` table. Each retains
the eight-byte `gasp` rasterization policy. Satoshi's original `gasp` remains.

## Pixel proof

**32/32 after frames exactly match a complete unchanged baseline control frame.**
Matched-frame changed pixels and maximum channel delta are zero.
All 32 also match the **first** baseline frame exactly; no case needed an
alternative control. Repeated unchanged baseline controls differed by 0–438
pixels (maximum channel delta 43), including blog-page compositing differences.
Those diagnostic comparisons are preserved in the measurements rather than
discarded or counted as font regressions.
Seven production pages and one expanded font specimen are checked at 1440px
and 390px widths, each at DPR 1 and 2, using Chrome **156.0.8078.47** with software
compositing on Linux. Three fixed baseline frames capture the original renderer's
rounded-corner variability. The first after frame must match one whole frame;
there are no masks, per-pixel mixtures, thresholds or retries until success.
Raw differences against every baseline control are recorded.

The specimen includes code fonts, inline family overrides, 300–700 weights,
12/16/24/48px text, accented and decomposed characters, italic text with nested
bold, tabular figures, disabled synthesis/kerning/ligatures, hyphenation,
stacked accents (`ſ̀́̃`), Greek plus combining accents and CJK. The frozen baseline
HTML is reused byte for byte. The non-font production CSS hashes identically.
Scripts, animations, caret changes and video/canvas motion are excluded
symmetrically; this is a settled-font proof, not a timed FOUT comparison.

Every observed difference during investigation was addressed:

- Narrowing the weight axis changed outline interpolation and anti-aliasing.
  The original axis is retained.
- An ASCII/punctuation split changed kerning, for example `Té` at 24px widened
  from 27.609375px to 29.484375px. The original Latin shaping group is retained.
- Reordering faces changed canonical decomposition and contextual substitutions
  around Extended-A letters. Original face priority is retained.
- Dropping apparently redundant faces or hidden cmap encodings changed stacked
  accent placement. Chrome actually requests the Cyrillic acute-mark face for
  the adversarial cluster. Original active faces and internal encodings remain.
- Chrome produced 53 rounded-corner pixels of difference on a mobile consent
  panel even for baseline versus baseline. Symmetric interception and fixed
  baseline controls distinguish that pre-existing compositing variation from
  a font regression. Only an exact whole-frame baseline match is accepted;
  no tolerance or pixel mask was added.

This does **not** claim Windows, macOS, Firefox or Safari pixel validation.
External embeds/API-supplied content beyond the checked repository content are
not certified. Audit and regenerate before publishing new repertoire.

## Deviations and their measured costs

| Safeguard | Cost / rejected reduction |
| --- | --- |
| Satoshi stays original because the ITF license forbids modification without prior written consent | 42,588 B remains; no speculative savings estimate was made by modifying it |
| Core retains its Latin shaping group rather than ASCII/punctuation alone | An ASCII-only core would be 25,964 B for Inter and 10,368 B for Instrument, saving 14,928 B and 4,144 B of critical payload but changing rendering |
| Inter's binary axis stays 100–900, default 400, rather than 300–700 | Narrowing would save 5,860 B across Inter, including 3,608 B in the core; its pixels changed |
| Inter uses five files instead of two | Three additional original-boundary shards total 7,772 B; ordinary pages request none of them |
| Preserve internally required cmap entries outside CSS coverage | These are included in the reported file/glyph counts; listing them as CSS coverage would change font matching |
| Keep original WOFF fallback formats | Two additional files total 26,452 B on disk; zero extra modern-browser requests; legacy core saves 624 B |
| Keep `gasp` policy rather than removing every hint-related table | Eight uncompressed table bytes per generated face; TrueType programs are removed |
| Leave media/OG pipelines unchanged | No reduction to the 96,872 B video font set or 93,240 B server-side OG inputs; they do not use these CSS faces |

Keeping Instrument Serif's actual hint instructions would make its generated
WOFF2 pair 31,020 B instead of 21,476 B: removing those instructions saves
**9,544 B** while matching every tested pixel.

Regeneration remains manual. No install/build hook, core embedding or idle
precache has been added.

## Data-processing check

| Tool/service introduced | Customer personal data sent? | New sub-processor / notice date / go-live | Result |
| --- | --- | --- | --- |
| Local FontTools/Brotli/Zopfli and existing Playwright/Sharp | No; processing stays local and browser probes block external requests | Not applicable | Pass |

No new runtime dependency, external application endpoint, credential,
retention policy or legal page was introduced or changed.
