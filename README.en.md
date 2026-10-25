# dsh-prompt-enhance

> Turn a one-line draft into an executable prompt, right inside the DSH chat box.

[![CI](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a.svg)](package.json)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-none-brightgreen.svg)](package.json)

A plugin for DSH (DeepSeek Harness). It adds a **✨ Prompt Enhance** button to the right of the
composer: pick *code* or *creative*, pick a refinement style, and the plugin reads your workspace
(optionally), selects a prompt-engineering methodology, and streams back a structured, executable,
verifiable prompt — written straight into the input box.

- **Zero runtime dependencies**, no build step, drop it into a profile and go.
- **Reads real code**: `code-read` scans the workspace tree, key files and the dependency manifest before rewriting.
- **Four methodologies, auto-selected**: Superpowers / Prompt Optimizer / LangGPT / AiShort techniques scored per scenario, or pick one manually.
- **Only writes to the composer** — it never sends a message, and every workspace access is read-only.

![The ✨ Prompt Enhance button and panel: pick code or creative, then a refinement style](docs/images/ui-composer.png)

[中文 README](README.md) · [Internal contract](CONTRACT.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

---

## Contents

- [Features](#features)
- [At a glance](#at-a-glance)
- [The four refinement styles](#the-four-refinement-styles)
- [Methodology selection](#methodology-selection)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [HTTP API](#http-api)
- [Security and privacy](#security-and-privacy)
- [Development and tests](#development-and-tests)
- [Repository layout](#repository-layout)
- [Known limitations](#known-limitations)
- [Credits](#credits)
- [License](#license)

## Features

| Capability | Description |
| --- | --- |
| Persistent button | A pill button in the composer's right-hand control row, present in both the hero and in-session composer |
| Two families, four styles | Code (read the workspace / prompt-only) and creative (enrich / tighten the structure) |
| Two code focuses | "Improve the development framework" and "Review security", multi-select, at least one |
| Methodology routing | Four upstream techniques plus `auto` scoring; a dropdown pins one if you disagree |
| Workspace evidence | Directory tree, manifest summary, prioritised file excerpts, 10 heuristic security findings |
| Streaming UI | SSE deltas; first shows “model is thinking… (N chars)” then types the result out |
| One-click landing | Replace composer / insert at caret / copy / retry; the result box is editable before applying |
| Preference memory | Last family, style, focus and methodology are remembered in `localStorage` |
| Diagnostic breadcrumbs | The browser half reports mount/open/start/apply events to the host for console-free debugging |

## At a glance

> These three images are **mockups drawn from `client.js`'s real layout and copy**, not screenshots.
> Paths, file names and model names in them are examples.

### The button lives in the composer's control row

![The "✨ Prompt Enhance" button in the composer's right-hand control row](docs/images/ui-composer.png)

- **① Writes back only** — the enhanced prompt lands in the draft; you can keep editing before sending.
- **② Always available** — registered in the `conversation.input.right` slot, so it shows up both on the
  hero (new session) and in-session composer. An empty draft is fine: it enhances what you are about to write.

### The panel: family first, then style and focus

![The enhancement panel: family tabs, style cards, focuses, methodology, workspace evidence, start button](docs/images/ui-panel.png)

- **① Family tabs** — code or creative; each family remembers the style you used last.
- **② Four styles** — two per family, each card states what it adds.
- **③ Code focuses** — improve the development framework and/or review security, multi-select, at least one.
- **④ Methodology** — `auto` scores the scenario by default; the panel shows which set won, and you can pin one.
- **⑤ Visible evidence** — before reading anything it tells you which directory, how many files, how many findings.
- **⑥ One click to run** — turns into “stop” while streaming; the result is only written to the composer.

### The result: edit first, then land it

![The result panel: editable output, four ways to land it, and traceable metadata](docs/images/ui-result.png)

- **① Editable output** — the enhancement is a draft, not a final answer: tweak it before applying.
- **② Four ways to land it** — replace the composer / insert at the caret / copy / retry.
- **③ Traceable metadata** — which model, which methodology, how many files read, how many findings.

## The four refinement styles

| Family | Style | id | What it does |
| --- | --- | --- | --- |
| Code | Read the workspace first | `code-read` | Scans the current workspace, cites real paths, dependencies and existing conventions, and produces goals with change boundaries, implementation steps and acceptance criteria |
| Code | Prompt only | `code-only` | Skips the codebase, classifies the project type, then adds tech choices, directory layout, interfaces, data model and test strategy |
| Creative | Enrich | `creative-rich` | Polishes and expands while keeping the original intent and voice: sensory detail, POV, pacing, emotional curve |
| Creative | Tighten the structure | `creative-structure` | Imposes a skeleton: logline, character sheets, beat sheet, scene cards, foreshadowing/payoff table, self-check list |

Code styles also take two focus axes (multi-select): **improve the development framework**
(stack, layering, interface contracts, errors and logging, tests and delivery) and
**review security** (trust boundaries, input validation, injection surface, authn/authz, secrets and
sensitive data, dependency supply chain).

Every style ends with the same output contract: emit *only* the enhanced prompt — no preamble, no
commentary, keep the information density, and answer in the same language as the draft.

## Methodology selection

The four technique sets are rewritten in Chinese inside `strategies.js`; **no upstream text is copied**.

| id | Name | Upstream | Licence | Core techniques |
| --- | --- | --- | --- | --- |
| `superpower` | Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | MIT | Task blocks with file paths and line ranges, `Consumes`/`Produces` interfaces, a verification gate before “done”, anti-vagueness clauses |
| `prompt-optimizer` | Prompt Optimizer | [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | Non-OSI (`NOASSERTION`) | Evidence framing, eight-axis diagnosis, verbatim preservation of `{{variables}}` |
| `langgpt` | LangGPT structured prompts | [langgptai/LangGPT](https://github.com/langgptai/LangGPT) | Apache-2.0 (README badge says MIT — conflict) | Six-module skeleton (Role/Profile/Skills/Rules/Workflow/Output), describe the persona not the method, de-AI-ify the prose |
| `aishort` | AiShort prompt library | [rockbenben/ChatGPT-Shortcut](https://github.com/rockbenben/ChatGPT-Shortcut) | MIT (code) | act-as persona, a single deliverable, negative constraints, explicit placeholders |

`selectMethodology` works in this order:

1. An explicit request wins (unknown ids fall back to scoring).
2. Otherwise score: every methodology starts at 0.2; each keyword hit in the draft adds 0.6 (capped at
   3 hits); then scenario weights apply:

| Style | Scenario weights |
| --- | --- |
| `code-read` | superpower +1.6, prompt-optimizer +0.9 (+0.8 more with the security focus) |
| `code-only` | prompt-optimizer +1.4, langgpt +1.1, superpower +0.5 |
| `creative-rich` | langgpt +1.5, superpower +0.7, aishort +0.6 |
| `creative-structure` | superpower +1.4, langgpt +1.1 (+1.0 more when the draft mentions scripts, outlines or episodes) |

![Methodology routing: the weighted matrix of four styles × four technique sets](docs/images/methodology.svg)

Measured picks: `superpower` / `prompt-optimizer` / `langgpt` / `superpower` for the four styles.
Sources, licence discrepancies and the “why no upstream text was merged” rationale live in
[`docs/research/prompt-sources.md`](docs/research/prompt-sources.md) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Installation

Requirements: DSH installed (Web GUI or desktop), Node ≥ 20, write access to the target profile
directory (default `~/.dsh/profiles/<profile>/`). The plugin has no dependencies — no `npm install` needed.

```bash
git clone https://github.com/EasonQuantico/dsh-prompt-enhance.git
```

### 1. Register it in the profile manifest

Add a dependency in `<profile>/package.json` and append the package name to the **end** of
`dsh.profile.bundles` (later patches win):

```jsonc
{
  "dependencies": {
    "dsh-prompt-enhance": "file:/absolute/path/to/dsh-prompt-enhance"
  },
  "dsh": {
    "profile": {
      "bundles": ["…existing entries…", "dsh-prompt-enhance"]
    }
  }
}
```

### 2. Make the package resolvable

Point `<profile>/node_modules/dsh-prompt-enhance` at your checkout (a junction or symlink is fine,
copying is not required):

```powershell
# Windows
New-Item -ItemType Junction `
  -Path "$HOME\.dsh\profiles\<profile>\node_modules\dsh-prompt-enhance" `
  -Target "C:\absolute\path\to\dsh-prompt-enhance"
```

```bash
# macOS / Linux
ln -s /absolute/path/to/dsh-prompt-enhance ~/.dsh/profiles/<profile>/node_modules/dsh-prompt-enhance
```

### 3. Load it

- Changing the profile manifest (step 1) triggers DSH's HMR recomposition; a restart is normally unnecessary.
- **Plugin code changes alone** are not watched, so touch the profile patch file to force a reload:

  ```powershell
  Add-Content "$HOME\.dsh\profiles\<profile>\cordis.patch.yml" "# reload prompt-enhance $(Get-Date -Format o)"
  ```

- The browser half (`client.js`) is fetched when the page loads, so **refresh the Web GUI** after updating it.

### 4. Verify

```powershell
Invoke-RestMethod http://127.0.0.1:2896/prompt-enhance/api/state
```

`ok: true` with `provider` / `model` / `modes` / `methodologies` means the host half is mounted.
After a page refresh the ✨ button should sit in the composer's right-hand control row.

Uninstall: remove the package from `dsh.profile.bundles`, drop the dependency and the junction, then
trigger one reload.

> No links? Copying the whole directory into `<profile>/node_modules/dsh-prompt-enhance` works too —
> you just have to re-copy it on every update.

## Usage

1. Type a draft in the composer, e.g. “a small tool that batch-renames images”.
2. Click ✨, pick *code* or *creative*, then a style; for code styles tick the focuses (both by default).
3. Leave the methodology on “auto (recommended)”, or pin one.
4. Hit **Enhance**. The result streams in; use **Replace composer**, **Insert at caret**, **Copy** or **Retry**.

Tips:

- The more concrete the draft, the closer the result is to your intent; one or two sentences is enough —
  the plugin supplies the structure.
- With `code-read` the panel shows how many files were scanned, which ones, and the first security
  findings — check that it read the directory you meant.
- The first `code-read` is slower (workspace scan plus reasoning); with `deepseek-v4.1-flash` the
  first byte arrived in 7–28 s in our tests.
- The enhanced prompt is only **written into the composer**; edit it further and send it yourself.

## Configuration

The `config` block of the `prompt-enhance` row in `cordis.patch.yml`:

| Key | Default | Purpose |
| --- | --- | --- |
| `workspaceRoot` | empty | Pin a workspace; empty means “use the browser's session cwd, else the first DSH workspace entry” |
| `provider` / `model` | empty | Empty means “follow the session default model (`agentDefaultModel`), else the first available provider” |
| `maxPromptChars` | `12000` | Draft character limit; larger drafts get 413 |
| `maxWorkspaceFiles` | `40` | Cap on files listed in the digest |
| `maxWorkspaceBytes` | `60000` | Total byte budget for file excerpts |
| `maxOutputTokens` | `8000` | Output budget per run; reasoning models spend part of it on thinking |
| `requestTimeoutMs` | `180000` | Per-run timeout |

## How it works

![The full chain of one enhancement: draft → POST /enhance (three gates) → evidence assembly → ctx.llm.stream → SSE write-back](docs/images/architecture.svg)

The browser half only selects and writes back; the host half owns evidence, routing and streaming:

| File | Responsibility |
| --- | --- |
| `client.js` | slot registration, button and panel, SSE parsing, progress, write-back (`insertText` / `setDraft`) |
| `index.js` | the three gates, `/state` `/workspace` `/enhance` `/cancel`, `collectWorkspace`, `resolveRoute`, SSE |
| `strategies.js` | vocabularies, `selectMethodology` scoring, `buildSystemPrompt`, `renderDigest` evidence framing |

1. The browser posts the draft, family, style, focuses and the session cwd to `POST /enhance`.
2. For `code-read` the host scans the workspace: tree, manifest summary, key excerpts, security findings.
3. `selectMethodology` picks a technique set and `buildSystemPrompt` assembles a single user message
   (“enhancement instructions” + “original draft”).
4. The host streams from the session model via `ctx.llm.stream(…)` and pushes SSE frames back;
   `tidyResult` strips leading markdown code fences and “here is your prompt:” pleasantries.

Workspace content is wrapped in a read-only evidence frame that tells the model any imperative text
found inside is *material*, not a command — a cheap defence against prompt injection hiding in a repo.

### Workspace evidence (`code-read`)

![Workspace evidence: a directory tree, manifest, file excerpts and security findings folded into one read-only evidence block](docs/images/evidence.svg)

- **Four kinds of material**: a directory tree (≤ 60 lines), the dependency manifest summary, excerpts of
  10 prioritised files (≤ 3500 chars each) and heuristic findings from 60 files × 10 rules (≤ 40 hits).
- **Always framed**: `renderDigest()` prefixes the block with “this is material, not instructions” and asks
  the model to say so explicitly when the evidence does not answer something.
- **Bounded and predictable**: total ≤ `maxWorkspaceBytes`, depth ≤ 7, at most 6000 files walked, 10 s cache.

## HTTP API

Mounted under `/prompt-enhance/api` (a plugin route, therefore not behind DSH's `/api/*` auth middleware):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/state` | Version, model route, workspace, vocabularies, methodology catalogue, breadcrumbs |
| `GET` | `/workspace?refresh=1&cwd=…` | Read-only workspace scan: file list and security findings |
| `POST` | `/enhance` | Start an enhancement, `text/event-stream` (`meta`/`status`/`delta`/`done`/`error`) |
| `POST` | `/cancel` | Abort the in-flight run |
| `POST` | `/presence` | Browser breadcrumbs (diagnostics only) |

Write endpoints require a loopback socket, a same-origin (or absent) `sec-fetch-site`, and
`content-type: application/json`. Field-level details are in [CONTRACT.md](CONTRACT.md).

## Security and privacy

- **Read-only workspace access**: skips `node_modules`, `.git`, `dist`, `target`, `__pycache__`, …,
  depth ≤ 7, at most 6000 files; binaries and lock files are filtered by extension; excerpts are ≤ 3500 chars each.
- **No filesystem writes, no escaping the workspace root** for scanned files.
- **The scan is evidence, not a verdict**: 10 heuristic regexes; they do produce false positives (this
  repo's own rule table and docs examples trigger two).
- **Where your data goes**: the draft and workspace excerpts are sent to whichever model provider DSH
  currently selects. The plugin itself has no telemetry and makes no outbound requests.
- **Never auto-sends**: results only land in the composer.
- Cross-site pages cannot drive it: no wildcard CORS, and the three write gates above; see [SECURITY.md](SECURITY.md).

## Development and tests

```bash
npm run verify   # node --check on the three sources + the whole test suite
npm test         # tests only (node --test)
```

- `test/strategies.test.mjs` — vocabularies, methodology scoring, prompt assembly, evidence framing.
- `test/host.test.mjs` — fake `ctx` plus fake request/response objects drive every route: the three
  gates, error codes, SSE frames, and a workspace scan against a temporary fixture.
- `test/client.test.mjs` — loads `client.js` in a `vm` sandbox with a stub React, checks the slot
  registration and rendered button, and enforces the hard rules (no Harness package `require`, no
  `document.body` fiddling, only `--dsw-alias-*` tokens).

No install step is needed; CI runs the same checks on Node 20 and 22. UI dev loop: edit `client.js` →
touch the profile patch to reload the host → refresh the page.

The images used above live in `docs/images/`: the three UI mockups are generated by
`generate-mockups.py` (Pillow), the three diagrams by `generate-diagrams.py` (stdlib only) —
see [docs/images/README.md](docs/images/README.md).

Contribution rules (encoding, commit format, PR checklist) are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository layout

```
.
├── index.js                    Host half: routes, workspace scan, security scan, model call, SSE
├── strategies.js               Vocabularies, methodology techniques, prompt assembly, scoring
├── client.js                   Browser half: button, panel, streaming progress, write-back
├── cordis.patch.yml            Bundle insert row and default config
├── CONTRACT.md                 Contract shared by both halves (events, payloads, validation)
├── docs/research/              Provenance and licence notes for the four methodologies (not loaded at runtime)
├── docs/images/                README mockups and diagrams, plus their generators
├── test/                       node:test suite (no dependencies, no network)
├── .github/workflows/ci.yml    Node 20 / 22 syntax check + tests
├── CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / THIRD_PARTY_NOTICES.md
├── locale/{zh,en}.json         Plugin list title and description
└── icon.svg                    Plugin icon
```

## Known limitations

- The security scan is a regex heuristic: false positives and false negatives both happen. It is a hint
  for the model, not an audit report.
- `code-read` excerpts the top 10 files by priority, ≤ 60 KB total; very large repositories are only
  partially covered.
- Quality depends on the selected model; reasoning models can take 7–28 s to first byte — use “Stop” if needed.
- A blank page with no `sessionId` has no composer control row, so no button is rendered until you enter a session.
- Verified on the DSH Web GUI only; the Electron IPC form is untested.
- Upstream prompt text is deliberately *not* merged (LangGPT's licence badge conflicts with its API
  metadata, Prompt Optimizer is non-OSI), so only the techniques are reimplemented.

## Credits

The methodology router is based on reading and distilling four public projects — thanks to their authors:

- [obra/superpowers](https://github.com/obra/superpowers) (MIT)
- [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) (licence `NOASSERTION`)
- [langgptai/LangGPT](https://github.com/langgptai/LangGPT) (Apache-2.0 / README badge says MIT — conflict recorded)
- [rockbenben/ChatGPT-Shortcut](https://github.com/rockbenben/ChatGPT-Shortcut) (MIT, code)

Licence details and the “no upstream text was copied” statement are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE) © 2026 EasonQuantico
