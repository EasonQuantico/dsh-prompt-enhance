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
