# Contributing

Thanks for taking a look. This is a small plugin; the fastest way to help is to try it
against your own workspace and file what breaks.

## Getting started

The plugin has **zero runtime dependencies** and does not need a build step. You need DSH
installed and a profile you can edit.

```bash
git clone https://github.com/EasonQuantico/dsh-prompt-enhance.git
cd dsh-prompt-enhance
npm run verify          # node --check on all sources + node --test test/
```

To load your checkout into a running DSH, point the profile at it (adapt the paths):

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": { "dsh-prompt-enhance": "file:/absolute/path/to/your/checkout" },
  "dsh": { "profile": { "bundles": ["...", "dsh-prompt-enhance"] } }
}
```

Also create a `node_modules/dsh-prompt-enhance` junction/symlink to the checkout so the
profile can resolve the package. Add the bundle name to the **end** of `bundles`; the last
patch wins.

## Repository layout

| Path | What lives there |
| --- | --- |
| `index.js` | Host half: HTTP routes, workspace reader, security scan, model call, SSE |
| `strategies.js` | Vocabulary, methodology fragments, prompt builders, methodology scoring |
| `client.js` | Browser half: button, panel, streaming UI, draft write-back |
| `cordis.patch.yml` | Bundle insert row and default config |
| `CONTRACT.md` | Internal contract between the two halves (events, payloads, guards) |
| `docs/research/` | Provenance notes for the four methodologies (not loaded at runtime) |
| `test/` | `node:test` suites, no fixtures on disk |

## Rules of the road

These come from the DSH plugin guide and are not negotiable:

- **The two halves share no imports.** The browser half runs from the page's module table
  and may only `require('react')`; never import a `@deepseek-ai/*` package, never reach
  into another plugin's DOM, never append to `document.body`.
- **Register through effects.** Everything registered inside `apply()` must be disposed by
  it (`ctx.effect(...)` / returned cleanup), including HTTP routes and slot components.
- **Style with theme tokens.** Use `--dsw-alias-*` custom properties and a `dpe-` class
  prefix; no hard-coded palettes, no global selectors.
- **Keep the contract honest.** If you change an event name, payload field or guard,
  update `CONTRACT.md` and `test/host.test.mjs` in the same commit.
- **No new dependencies** without discussing it first; the CI matrix is dependency-free
  on purpose.

## Tests

```bash
npm test                       # whole suite
node --test test/host.test.mjs # one file
```

- `test/strategies.test.mjs` — vocabulary, scoring, prompt builders.
- `test/host.test.mjs` — routes with a fake `ctx` (no server, no model).
- `test/client.test.mjs` — the `window.__ModuleLoader__` factory, in a `vm` sandbox with a
  stub `React`.

Tests must not touch the network or the real DSH installation. Temporary fixtures go to
the OS temp directory and are removed in `finally`.

## Commits and pull requests

- Conventional-commit subjects (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- One behaviour change per PR; include the verification you ran.
- Add a `CHANGELOG.md` entry under `Unreleased` for user-visible changes.
- Chinese and English are both fine in issues and PRs.
