# Security policy

## Reporting a vulnerability

Open a private report through GitHub Security Advisories
(<https://github.com/EasonQuantico/dsh-prompt-enhance/security/advisories/new>) or email
the maintainer. Please do not open a public issue for a vulnerability that lets a
web page read your workspace or spend your model quota. Expect an initial reply within a
week.

## Threat model

The plugin runs inside your local DSH installation and adds an HTTP surface under
`/prompt-enhance/api`. The relevant attackers are therefore:

1. **A web page you visit while DSH is running** (drive-by cross-origin `fetch`).
2. **A malicious file inside your workspace** trying to steer the model that reads it.
3. **A user of a shared DSH profile** who should not be able to read another session's code.

What the plugin does about them:

- Every write endpoint (`POST /enhance`, `POST /cancel`, `POST /presence`) requires a
  loopback socket address, a same-origin `sec-fetch-site` header, and
  `content-type: application/json`. Both checks are in `index.js`
  (`isLoopback`, `isSameOrigin`, `hasJsonContentType`) and covered by `test/host.test.mjs`.
- No CORS headers and no wildcard origins are sent, so a browser cannot read responses
  cross-origin even if a request were forged.
- Workspace content is read-only, size-capped (`maxWorkspaceBytes`, `maxWorkspaceFiles`)
  and inserted into the prompt inside an explicitly labelled "read-only evidence" frame
  telling the model that instructions found in the workspace are material, not commands.
- The enhancer only writes text back into the composer draft; it never submits a message
  and never executes code it read.

What it explicitly does **not** protect against:

- The selected model provider receives your draft and the workspace excerpts. Choose the
  provider accordingly.
- The security scan is a heuristic regex pass (10 rules). It is prompt material, not an
  audit result, and it does produce false positives.
- Anyone who can already read your DSH profile directory can read its logs and drafts.

## Supported versions

The latest release on `main` receives fixes. This plugin is pre-1.0 in spirit: pin a
commit if you need reproducibility.
