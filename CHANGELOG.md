# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Docs

- Installation gained a “new version, old behaviour?” section: `dsh plugin install` copies a
  `file:` dependency into the profile, so a checkout-only edit keeps the old code alive until that
  copy is replaced by a junction (or re-installed). Also documents that the Web GUI port changes
  between launches.

## [1.4.1] — 2026-10-31

Layout follow-ups found by running the panel in a real browser at 1440×900 after the 1.4.0 styling
pass.

### Fixed

- The panel could be taller than the space above the composer, because `max-height` excluded the
  panel's own padding (`content-box`): it now measures with `box-sizing: border-box`, so the panel
  stays inside the viewport instead of running off the top edge.
- The workspace note listed four full paths and wrapped to four lines; it now shows three paths
  shortened to their tails so the note stays two lines.
- The workspace and document refresh buttons borrowed the “enhancing…” string while reading; they now
  have their own “reading…” copy in both languages.

## [1.4.0] — 2026-10-31

Audit against the official DeepSeek Harness development guide (styling, defensive client patterns,
plugin compatibility) and the fixes it produced.

### Added

- `engines.dsh: ">=0.2.0-rc.2"` so the harness judges compatibility from the plugin manifest (DSH
  0.2.1-alpha.3 reads `engines.dsh` first and falls back to `peerDependencies`).
- Four workspace budgets are now config fields instead of hardcoded constants: `maxExcerptChars`
  (3500), `maxScanFiles` (60), `maxScannedBytes` (921600), `maxListedDocuments` (800). They are
  validated like the other numeric keys and reported by `/state`.
- A “Compatibility and the official guide” section in both READMEs, mapping each requirement to the
  place in this plugin that satisfies it.

### Changed

- The panel CSS was rewritten to follow `docs/web-styling.zh.md`: no colour literals (only the
  filled button keeps the harness's own `#fff` text), 0.5px neutral hairlines with 1px state borders,
  `corner-shape: round` on every capsule and circle, all hover styles behind `@media (hover: hover)`,
  every `font-size` paired with a `line-height`, and the panel drawn as an elevated surface
  (`border: 0` + `box-shadow: var(--dsw-elevation-panel)`) instead of a bordered box.
- `useLayoutEffect` for panel placement now carries the reason it cannot be `useEffect` (a post-paint
  measurement would flash the fixed panel at the wrong spot).

### Fixed

- Thirteen silent `catch` blocks now name the error and why they swallow it (unreadable file,
  vanished directory, absent registry, already-closed response, released route), as the developer
  guide requires of empty catches.

### Tests

- `panel styles follow the harness styling rules`: fails if a colour literal, a theme selector, a
  custom scrollbar, an unpaired capsule radius or a non-hairline neutral border sneaks back in.
- `workspace excerpts honour maxExcerptChars from the config`: proves the new budget actually reaches
  the digest, not just `/state`.

## [1.3.0] — 2026-10-29

Bilingual interface: the panel can switch its own copy between Chinese and English, instantly and
persistently, without touching the harness language.

### Added

- `COPY` map with a `zh` and an `en` half in `client.js`; every user-visible string (buttons, empty
  states, error messages, aria labels, option text) now goes through it.
- Two language chips in the panel header (`中文` / `English`), rendered from `LANGUAGES` and
  `LANGUAGE_LABELS`; clicking one re-renders the whole panel in that language with no page reload.
- The first run follows the harness language (`ctx.get('locale').getLocale().active`), so an English
  harness starts in English; the user's pick is then stored under `lang` in
  `dsh-prompt-enhance.prefs` and wins on every later load.
- Three tests: `both languages carry the same copy` (key sets must match), `a stored language switches
  the whole interface`, `the language follows the harness until the user picks one`.

### Changed

- The `LABELS` object is now `COPY[lang]`; the component keeps a local `LABELS` binding so the existing
  call sites did not need rewriting.
- Transport errors (`requestFailed`, `streamUnsupported`) read from the same map instead of hard-coded
  Chinese.

### Notes

- Only the plugin's copy changes. DeepSeek Harness keeps its own language; the locale service stays an
  optional dependency (`inject` is still `['slots']`).

### Docs

- Both READMEs gained an “Interface language / 界面语言” section: what the chips do, that the first run
  follows the harness, where the choice is stored, and that the harness language is left alone.
- Two real screenshots from a bench run (`docs/images/ui-language-zh.png`, `ui-language-en.png`), plus
  a note in `docs/images/README.md` about which pictures are mockups and which are captures.

## [1.2.0] — 2026-10-26

Length control: every request now carries a depth level, and Superpowers' thorough band is the
yardstick every other methodology is measured against.

### Added

- Three depth levels (档位): `concise` (简洁), `default` (默认) and `thorough` (严谨). The panel
  grew a chip row, `POST /enhance` accepts `depth`, `/state` publishes `depths`, and the `meta`
  event reports `depth`, `depthLabel` and the quoted `depthBudget`. An unknown level is a
  `bad-depth` 400; an omitted one means `default`.
- `strategies.js` exports `DEPTHS`, `DEPTH_IDS`, `METHODOLOGY_LENGTH`, `depthBudget()` and
  `docOutputRule()`. Budgets are `clamp(4200 × levelScale × methodologyRatio)`, with
  `levelScale` 0.34 / 0.64 / 1 and ratios superpower 1, prompt-optimizer 0.72, LangGPT 0.74,
  AiShort 0.55 — calibrated on 2026-10-26 by running all four sets at both ends of the range on one
  request (thorough 5794 / 3906 / 4249 / 2901 chars, concise 1941 / 1466 / 1438 / 1149). So
  “thorough AiShort” is still shorter than “thorough Superpowers”, while a level means the same
  thing for every house style; the model overshoots the printed budget by ~1.3–1.5× consistently.
- Each level line is a hard cap (“硬上限 N 字，超出就必须删到上限以内”) plus a shared
  “count before you hand in” self-check, which brought the overshoot down from ~1.9× to ~1.4×.
- Shorter levels also say what to cut first for the chosen methodology (plan steps and interface
  tables for Superpowers, Role/Profile merge for LangGPT, …) instead of only lowering a number.
- Document mode quotes its own budget (`整体不超过 N 字`) and prefers writing section by section.

### Changed

- `OUTPUT_CONTRACT` no longer hard-codes “1200 字 / 2000 字”; it defers to the depth budget line.
- The result footer shows the level and its budget (`档位 简洁 · ≤1428 字`).

## [1.1.1] — 2026-10-26

### Fixed

- `/documents` and the `meta` event reported the whole file length while the model only
  received an excerpt capped by `maxDocumentChars`. The length is now always the real file
  length, `truncated` is reported for both the listing and the selected document (plus
  `documentTruncated` in `meta`), and the panel labels a shortened excerpt with
  「（已截断）」. Heading outline and formatting traits are still computed from the whole file.

### Changed

- The candidate picker's first option reads `自动挑选（相关性优先）`: ranking weights prompt
  relevance more than recency.
- `SECURITY.md` spells out the document-specific checks (root confinement, text-only
  extensions, `maxDocumentChars`) and no longer calls the plugin pre-1.0.

## [1.1.0] — 2026-10-26

Third family, documentation mode.

### Added

- Documentation family (文档): `doc-fill` reads the current document's heading outline and
  formatting traits and rewrites the prompt so the model fills the gaps inside that structure;
  `doc-draft` drafts a document-type skeleton when there is nothing to read.
- `GET /prompt-enhance/api/documents` lists readable documents, ranks them by prompt relevance,
  sub-directory, `docs/`, recency and size, and returns the outline plus formatting traits of the
  document that would be read. `POST /enhance` accepts `docPath` and reports
  `documentPath` / `documentChars` / `documentHeadings` in the `meta` event.
- Document evidence framing (`renderDocDigest`): outline, formatting traits, excerpt and sibling
  documents are injected as read-only evidence; unsupported gaps must be written as
  “待补充：需要 X（来源）”.
- `docSystem` fragments for all four methodologies, so document work still routes through the
  same adaptive scoring (`doc-fill` → LangGPT, `doc-draft` → LangGPT in the measured cases).
- `maxDocumentChars` config (default 16000) and the `doc-outside-root` / `doc-unsupported` /
  `doc-unreadable` / `no-document` validation codes.
- Document line in the panel (selected path, size, heading count, outline preview, candidate
  picker, refresh) and `document*` metadata in the result footer.

### Docs

- README (both languages) now leads with eight illustrations: four UI mockups drawn from
  `client.js` (button, panel, document panel, result) and four diagrams (request chain, methodology
  scoring matrix, workspace evidence, document evidence). Generators live in `docs/images/`; the
  mockups are labelled as mockups, not screenshots.

## [1.0.0] — 2026-10-25

First public release.

### Added

- Composer button (`conversation.input.right` slot) that opens the enhancement panel
  without leaving the chat.
- Four enhancement variants: `code-read` (scan the workspace first), `code-only`
  (prompt only), `creative-rich` (enrich and polish), `creative-structure`
  (script/story structure).
- Two code focus areas, multi-select: framework completeness and security review.
- Adaptive methodology selection across four upstream prompt-engineering projects
  (Superpowers, Prompt Optimizer, LangGPT, AiShort), plus manual override.
- Host HTTP API under `/prompt-enhance/api`: `GET /state`, `GET /workspace`,
  `POST /enhance` (SSE), `POST /cancel`, `POST /presence`.
- Workspace collector: directory tree, manifest summary, prioritised excerpts and a
  10-rule heuristic security scan.
- Streaming UI with reasoning progress, then replace-draft / insert-at-caret / copy /
  retry.
- Panel preferences persisted in `localStorage`.
- `docs/research/prompt-sources.md` recording upstream provenance and licence caveats.
- Test suite (`node --test`) covering the strategies layer, the host routes (with a fake
  `ctx` and fake request/response) and the client module registration.
- GitHub Actions CI on Node 20 and 22.

### Notes

- The plugin is not published to npm; install it as a local bundle (see README).
- Draft and workspace excerpts are sent to the model provider selected in DSH.

## [0.1.x] — 2026-10-25 (internal)

- Prototype iterations: host routes and SSE streaming first, then the client dock, then
  the move from `conversation.composer.dock` to `conversation.input.right` after the
  earlier slot turned out to be invisible to users in the hero composer.
