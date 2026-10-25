# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Docs

- README (both languages) now leads with six illustrations: three UI mockups drawn from
  `client.js` (button, panel, result) and three diagrams (request chain, methodology scoring
  matrix, workspace evidence). Generators live in `docs/images/`; the mockups are labelled as
  mockups, not screenshots.

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
