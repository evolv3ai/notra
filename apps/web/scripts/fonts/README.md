# Website font subsets

Run this tool by hand. Deployment, install and build scripts do not process fonts.
Commit the generated fonts, `src/styles/fonts.css` and `inventory.json` together.

## Regenerate

From the repository root, with the repository's Bun/Node versions and dependencies installed:

```sh
bun install --frozen-lockfile
bun run --cwd apps/web styles:generate
uv run --python 3.12 --with-requirements apps/web/scripts/fonts/requirements.txt \
  python apps/web/scripts/fonts/subset.py
```

FontTools, Brotli and Zopfli are pinned in `requirements.txt`. Oxfmt from the
repository formats generated CSS and JSON. Python is not needed to build or serve
the site. Fontsource dependencies remain installed for the original coverage
and inventory checks; their Knip exceptions are for this manual tool.

Rerun after changing content, translations, typography or reachable shared UI.
Check inline styles, SVG text, Markdown emphasis and numeric variants as well as
stylesheets. Audit the weight/feature policy again when those settings change;
the script collects characters, not the meaning of CSS or component inheritance.
New content beyond the retained repertoire needs regeneration before publication,
including content supplied by an external embed or API.

The corpus includes website TS/TSX/CSS/MD/MDX/JSON, relative stylesheet imports and
the shared files listed in `src/styles/ui-sources.css`. It includes source strings and comments,
not just visible text. It keeps supported Latin-1, Latin Extended-A, canonical
decompositions, U+2010 and the trademark character. CJK stays in system fonts.
It never invents characters the original faces did not support.

## Appearance safeguards

- Inter's binary keeps its original 100–900 weight axis. Restricting it to the
  observed 300–700 range changes interpolation and pixels. Its CSS descriptor
  advertises the audited 300–700 range. The original Fontsource import is
  **wght-only**: it has no optical-size axis to change or restrict.
- The core includes the original Latin shaping group, including Latin-1 accents
  and supported combining marks. A smaller ASCII/punctuation core loses kerning
  across file boundaries. Extended faces come **before** the core face, as
  in the original Fontsource CSS: priority also affects canonical decomposition
  and contextual substitutions around Latin Extended-A letters.
- Inter retains separate Latin Extended-A, Greek, Cyrillic/acute-mark and
  Vietnamese/combining-mark extended shards. Chrome can request the acute-mark
  face even when its character is covered by another face. Original coverage
  overlaps and face priority are intentional. This is five WOFF2 files for Inter,
  not the requested two; ordinary pages still
  request only its core. Instrument Serif has two logical subsets.
- Default shaping, contextual alternates, kerning, mark positioning and used
  tabular figures remain. Unused optional features and TrueType instructions
  are removed. The eight-byte `gasp` rasterization-policy table remains in each
  shard; it is not executable hinting.
- Only normal faces existed before. Italic and bold-italic synthesis, including
  components that disable synthesis, stay unchanged. No new italic face, alias,
  fallback family or `font-display` value is introduced.
- Both derived OFL fonts use new internal names (`Notra Text`, `Notra Accent`)
  while keeping the existing CSS families. Copyright and license metadata remain;
  full licenses are served under `public/fonts`.
- Satoshi is **not** an OFL font. Its [ITF license](https://fontshare.com/licenses/itf-ffl)
  prohibits subsetting and other modification without prior written consent. Its
  original file is untouched. The video and server-side OG font pipelines are
  measured separately and are not changed by this CSS-font optimization.
- Instrument Serif retains WOFF fallbacks as well as WOFF2 for both logical
  subsets. WOFF2 browsers do not download the WOFF copies.
- All generated URLs use Vite's `?no-inline` flag. Otherwise Vite embeds the
  smallest extended fonts into global CSS, bypassing conditional downloads.

Some original cmaps also encode combining marks outside their CSS ranges, for
shaping a cluster whose base uses that face. Those encodings must survive even
when CSS must not select that face for a standalone mark. The generated CSS
therefore lists the intersection of the actual cmap with the original face's
effective CSS coverage. Every listed character exists; some internally needed
encodings intentionally remain outside that list.

FontTools' bidi closure may retain a mirrored character too. The tool reopens
every result and checks actual coverage, CSS coverage, names, axes and the
removal of hint instruction tables. It fixes Python's hash seed for reproducible
FontTools output and explicitly selects FontTools' Python layout serializer, so
an optional HarfBuzz installation cannot silently change its bytes. WOFF copies
use Zopfli compression.

## Reproduce the visual proof

Build an old-font baseline and the optimized version from **identical content**.
For this PR the baseline is commit `012c060`, and the implementation changes no
content or non-font styles. Keep its production artifact available separately.
When repeating this after a content update, apply the new content to the
old-font baseline too; comparing different content is not a font regression test.

Serve the two production artifacts on loopback, for example on ports 3101 and
3102 using `PORT=3101 HOST=127.0.0.1 node .output/server/index.mjs` in each app
directory. Then, from the optimized repository root:

```sh
node apps/web/scripts/fonts/verify.mjs capture http://127.0.0.1:3101 "$HOME/.cache/notra-font-proof"
node apps/web/scripts/fonts/verify.mjs compare http://127.0.0.1:3102 "$HOME/.cache/notra-font-proof"
```

The verifier uses the existing dashboard Playwright dependency and website Sharp
dependency. It defaults to Chrome at `/opt/google/chrome/chrome`; pass
`--chrome=/path/to/chrome` to select another installed browser binary. Pass
`--route=/brand` for a focused capture/compare. To check the harness itself,
compare against the baseline origin with `--control`.

It captures seven hydrated production pages plus a synthetic typography specimen,
then freezes the baseline DOM, removes scripts and uses that same HTML for both
renders. Animation, caret and video/canvas changes are disabled symmetrically;
external requests are blocked. The non-font production CSS must hash identically.
Both sides use the same stylesheet interception path and software compositing.
Chrome can still alternate rounded-corner raster states with unchanged fonts.
Capture records exactly three baseline control frames per case; the first after
frame must equal one complete baseline frame, pixel for pixel. There are no
pixel masks, per-pixel combinations, thresholds or retake-until-pass loops.
Comparisons against all three controls are recorded. Any novel changed pixel
produces a failing exit status and a raw diff image.

Screenshots cover 1440px and 390px widths at DPR 1 and 2. The specimen covers
12/16/24/48px text, audited weights, italics with nested bold, accented and
decomposed text, tabular figures, inline aliases, disabled synthesis/kerning,
system code fonts, automatic/soft hyphenation and CJK. Separate fresh-context
requests check core-only, Latin-1, Latin Extended-A and CJK cases. CDP records the
actual web/system fonts used.

JSON results and PNG evidence stay in the output directory, outside Git. Keep
`measurements.json` and the summary in `REPORT.md` current when publishing new
subsets. The proof is specific to the recorded Chrome/Linux environment; it is
not a claim that Windows, macOS, Safari or Firefox were tested.

## Source provenance

Inputs are the original files in the locked `@fontsource-variable/inter@5.3.0`
and `@fontsource/instrument-serif@5.3.0` packages. The script rejects other
versions. `inventory.json` records every input SHA-256, cmap, feature set and
axis. No extra full-font source copies are committed or downloaded by the tool.
On a font upgrade, review the licenses, update the version guard and repeat
the same-content comparison before publishing new subsets.

Inlining the core or idle-precaching extended files is deliberately deferred.
