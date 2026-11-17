# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] — 2026-11-17

### Changed

- Renamed the project to **`dsh-prompt-enhance-ultra`**: the npm package, the GitHub repository
  (old URLs redirect), the DSH bundle row, the HTTP route prefix (`/prompt-enhance-ultra/api`), the
  plugin id reported by `/state`, the localStorage preference key and every install snippet. The
  panel copy stays 「提示词增强」 in Chinese and "Prompt enhancement" in English.
- The automatic mode now returns **two** candidates instead of three: a **concise** pass and the
  **best-fit methodology**. The concise pass follows the method of
  [Samuel-Shek/prompt-optimizer-skill](https://github.com/Samuel-Shek/prompt-optimizer-skill) (MIT):
  the draft is kept verbatim as the spine and the execution notes are appended into the same prompt,
  so the candidate is **one complete, ready-to-paste prompt** — no 「任务：」 / 「用户原话（按此执行）：」 /
  「补充说明：」 section labels, no template scaffolding. Only *how* is written — no invented bans,
  counts, orderings or acceptance criteria — gaps stay as `{{待填写：名称｜格式示例}}` placeholders, and
  length is capped at about twice the original.
- `ACT_ROLES`, `actById` and `selectAct` are gone, along with the `act` and `structure` routes: the
  prompts.chat-derived role library is no longer shipped. `AUTO_ROUTES` is now
  `concise` + `methodology`, and `POST /candidates` plans exactly two slots.
- `buildConcisePrompt({ promptText, intent })` is exported and is what the concise slot calls;
  `buildAutoPrompt` routes `route: 'concise'` straight to it. `CONCISE_RULES`, `CONCISE_LENGTH_RULE`
  and the per-intent hints are exported for tests and docs.
- `GET /state` no longer lists `acts`; its `routes` are the two new ids. The candidate card title falls
  back to the route label so 「简洁优化 · 简洁优化」 cannot happen.
- When an automatic run finishes, the candidate list scrolls into view: in a short window the panel
  scrolls internally, and the two cards could otherwise land just below the fold.

### Docs

- README (both languages) rewritten around the two routes, `CONTRACT.md` documents the two slots and the
  removed `act` route, `THIRD_PARTY_NOTICES.md` swaps the prompts.chat entry for the MIT skill repository
  (and records that the role library was removed). `docs/images/ui-auto.png` was regenerated with two cards.

## [1.5.2] — 2026-11-16

### Changed

- The automatic mode no longer has a length level. Each candidate now decides how long its answer should
  be from the task itself: a one-step job stays a few lines, a multi-stage job earns its sections. In
  practice:
  - `POST /candidates` ignores a `depth` field (it neither honours it nor rejects it — no more
    `bad-depth` on this endpoint), and its system prompt carries a length *policy* (「篇幅要求：不设档位，
    按任务本身判断该写多长」) instead of a character budget.
  - `meta` and `done` stopped reporting `depth` / `depthLabel` / `depthBudget`; the three candidates are
    now free to differ in length, which is the point.
  - The auto view dropped the depth row and its hint, and says so in one line ("每组候选只按任务需要写长
    或写短，不凑字数，也不会为了简短丢掉必要步骤"). The advanced view keeps the three levels unchanged.
  - `buildAutoPrompt` no longer takes `depth`; `AUTO_LENGTH_RULE` is exported so tests and docs can cite
    the exact wording. `docOutputRule()` now accepts a missing budget and emits the qualitative form.

### Docs

- README (both languages) and `CONTRACT.md` describe the split: automatic = length follows the task,
  advanced = three levels with budgets. The `ui-auto.png` mockup was regenerated without the depth row.

## [1.5.1] — 2026-11-16

### Changed

- The panel now follows the Harness surface language instead of its own paint:
  - Header is a title/subtitle stack with the language pill and the close button pushed to the edges;
    the view switch (`自动 | 高级`) and the in-panel switches (`代码 | 创作 | 文档`, depth chips) are
    segmented controls on the same 12 px track — the active pill is a white card with a soft
    elevation, the track is `--dsw-alias-interactive-bg-hover`.
  - Inputs and results are separated by hairline sections (`.dpe-section` / `.dpe-sep`,
    `0.5px solid var(--dsw-alias-border-l1)`) so a long panel reads as three blocks instead of one
    column of boxes.
  - Small type went up a notch for readability: labels 12 px, hints and meta 11.5 px on an 18 px
    line, book text 13 px; every interactive element has a `2px solid` `--dsw-alias-button-info-fill`
    focus ring, and `@media (prefers-reduced-motion: reduce)` removes the remaining transitions.
  - The panel is 412 px wide (was 384) and anchors its right edge to the trigger, so it sits over the
    composer's right side instead of floating off-centre.

### Fixed

- The panel could hang over the composer and hide the input: placement used the trigger's top edge
  as its only anchor. It now finds the composer card (the nearest tall ancestor that owns the
  contenteditable) and floats above *that*, capping its height to the free space so the input stays
  visible; on windows narrower than 620 px it becomes a top sheet that spans the width.
- The refresh button in the workspace/document note stretched to the full panel width (`.dpe-note`
  is a flex column); it now keeps its own size and aligns left.
- The auto view's action row and hint were floating between blocks; they are a single left-aligned
  stack with a full-width primary action, matching the advanced view's composition.
- The automatic mode could make the panel look dead ("自动优化后页面消失无响应"). Two host-side
  causes and one client-side cause, all fixed:
  - `handleCandidates` used one timeout for the whole run (`requestTimeoutMs`) and — on timeout —
    set `job.closed = true`, which silently killed the stream: the client saw the SSE close without a
    `done` or `error`, reset its state and showed an empty candidate list. Timeouts are now per LLM
    call (`callTimeoutMs`, new config key, default 120 000): a slow route only fails *its own*
    candidate (`slot-error`) while the remaining routes keep generating.
  - A failed intent pass also aborted the whole run. It now degrades to the keyword heuristic
    (`status { stage: "intent", degraded: reason }`) and the three candidates still generate.
  - A new run-level deadline (`requestTimeoutMs`, now 420 000) still ends the whole run when every
    step had its own chance; cancelling or disconnecting clears it via the job handle.
- Client fallbacks so the panel can no longer appear dead: an empty candidate list shows an
  `模型返回了空结果` note instead of a bare label; auto-mode errors render in the `error` state too
  (they were only visible while idle); the trigger button ignores accidental clicks while the panel
  is open and candidates are streaming (that click closed the panel mid-run); the notice clear timer
  no longer overwrites a newer notice after unmount.
- CSS: `.dpe-auto-candidates` / `.dpe-auto-card` / `.dpe-auto-text` / `.dpe-view-tabs` had no rules
  at all — candidate cards now stack vertically, previews clamp at 140 px so all three cards stay
  reachable in the panel's own scroll.
- The panel vanishing the moment an automatic run started — the real cause: `autoBody` read
  `runningHint` while that `const` was still declared further down the component, so the first render
  of the running state threw `ReferenceError: Cannot access 'runningHint' before initialization`.
  DeepSeek Harness catches a crashed slot entry and unmounts it, which removed the trigger button
  *and* the panel, so the page looked like it had swallowed the plugin. The hint is now declared
  before both view bodies, and a regression test pins the declaration order.
- The advanced view never updated while streaming: `streamSse` dispatches handlers by SSE event
  name, but `start()` still passed `onMeta`/`onStatus`/`onDelta`/`onDone`/`onError`. Nothing was
  wired, so the panel sat on "增强中…" and looked frozen even though the host was streaming. The
  handlers now use the event names (`meta`, `status`, `delta`, `done`, `error`).
- The panel resized on every token, which saturated layout during a run: three effects measured
  placement (one of them after *every* render), and each measurement re-fitted the height to the
  growing text. Measurements are now coalesced to one per animation frame (`requestPlacement`), a
  `ResizeObserver` replaces the measure-after-every-render effect, and the height is frozen for the
  duration of a run (`frozenHeightRef`) so the box stops growing under the reader.
- Streamed text now updates once per frame instead of once per delta (both views), so a fast route
  no longer forces hundreds of React renders per second.
- Residue: closing the panel or switching view clears the previous error/notice/toast, so reopening
  never shows a stale message from the last run.

### Docs

- Installation gained a “new version, old behaviour?” section: `dsh plugin install` copies a
  `file:` dependency into the profile, so a checkout-only edit keeps the old code alive until that
  copy is replaced by a junction (or re-installed). Also documents that the Web GUI port changes
  between launches.

## [1.5.0] — 2026-11-15

## [1.5.0] — 2026-11-15

The automatic mode: leave the panels to the plugin. The panel now opens on a `自动 | 高级`
view switch; the default `自动` view classifies the draft and returns three route-tagged
candidates to choose from, while `高级` is the familiar manual panel (code/creative/doc,
focus, depth, methodology).

### Added

- `POST /candidates` (SSE): one small LLM call recognizes the draft's intent
  (`{"intent":"code|creative|doc","summary","keywords"}`), with a keyword-heuristic fallback
  labelled `source: "heuristic"`. The host then plans three candidates — the top methodology
  for that intent (`methodology`), one act role (`act`), and a second house style applied to
  the same intent (`structure`) — and streams them as `delta`/`slot-done`/`slot-error`
  events tagged with `slot`; `done` aggregates `{ intent, intentSummary, depth, slots }`.
- `ACT_ROLES` in `strategies.js`: ten bilingual act roles (Code Reviewer, QA Tester, Security
  Auditor, Architect, Tech Writer, Screenwriter, Novelist, Copy Editor, Translator, Summarizer)
  whose *techniques* are distilled from the act cards in f/prompts.chat (CC BY-NC — only the
  technique, never the card text; provenance in `docs/research/prompt-sources.md`), each with
  keyword scoring, an intent affinity and one-line Chinese brief.
- `selectMethodology` now also returns a `ranked` list so the structure route can reuse the
  runner-up house style.
- `buildAutoPrompt`, `selectAct`, `variantForIntent` and `AUTO_ROUTES` exports.
- `/state` exposes the catalogue for the new surfaces: `acts` (id/zh/en/applies) and `routes`.
- Client: `自动 | 高级` view switch above the type tabs (remembered as `view` in
  `dsh-prompt-enhance-ultra.prefs`, default `auto`); the auto view shows the recognized intent, three
  candidate cards with provenance labels (`方法论路线` / `角色路线` / `结构路线` + the route's
  house style or act role), a `使用这组` write-back and a `复制` action per candidate; a failed
  route shows `该路线生成失败` instead of vanishing while the others complete.
- `strategies.js` gained the automatic mode helpers behind unit tests, and the host suite
  covers the whole `/candidates` pipeline (intent probe, plan, per-slot completion and the
  one-route-fails-others-survive contract). Suite is now 73 tests.

## [1.4.2] — 2026-11-15

The panel used to be clipped by the page's own overlay while the composer was on screen. It now lives
in the browser's top layer and re-places itself for every window size.

### Fixed

- The panel was drawn under the harness' first-run overlay: it was a `position: fixed` node inside the
  composer stack (`z-index: 1`), so a page-level `z-index: 1000` layer painted over it. The panel is
  now a manual popover (`popover="manual"` + `showPopover()`), which puts it in the top layer, with a
  feature test and a plain fixed-position fallback for browsers without the Popover API.
- The panel no longer collapses into a scroll box when the composer sits mid-window: placement now
  measures the real content height (`scrollHeight`), fits the panel above or below the trigger when
  possible, and otherwise slides it up so the whole panel stays inside the viewport.
- The panel no longer covers the button that opened it: when it has to overlap the composer, it slides
  beside the trigger instead. Below ~600 px of width there is no room beside the button and the panel
  keeps covering it, which the ✕ button and outside clicks still resolve.
- Placement is re-measured on `resize`, composer `scroll`, `visualViewport` changes, and whenever the
  panel's content grows (workspace note, document list, streaming result), so a resized window never
  leaves the panel half outside.

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
  `dsh-prompt-enhance-ultra.prefs` and wins on every later load.
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
- `GET /prompt-enhance-ultra/api/documents` lists readable documents, ranks them by prompt relevance,
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
- Host HTTP API under `/prompt-enhance-ultra/api`: `GET /state`, `GET /workspace`,
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
