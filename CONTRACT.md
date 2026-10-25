# dsh-prompt-enhance — internal contract

Single source of truth shared by the host half (`index.js`, `strategies.js`) and the
browser half (`client.js`). Both halves live in one bundle package; the host serves the
HTTP API and the client renders the composer control-row UI.

## Identity

- package name / client module id: `dsh-prompt-enhance`
- host route prefix: `/prompt-enhance/api`
- cordis row id: `prompt-enhance`

## Vocabulary

`mode` — the top-level choice shown in the UI:

| id | label (zh) | variants |
| --- | --- | --- |
| `code` | 代码 | `code-read`, `code-only` |
| `creative` | 创作 | `creative-rich`, `creative-structure` |

`variant` — the concrete enhancement style:

| id | label (zh) | meaning |
| --- | --- | --- |
| `code-read` | 读取工作区后优化 | read the workspace digest first, then rewrite the prompt against real files |
| `code-only` | 仅按提示词优化 | no workspace read; infer the dev type from the prompt alone |
| `creative-rich` | 补充丰富型 | polish + expand the wording (imagery, detail, rhythm) |
| `creative-structure` | 结构严谨型 | impose a rigorous structure (script/beat sheet, or product copy skeleton) |

`focus` — only for `code` variants, at least one required:

- `framework` — 完善开发框架 (architecture, module layout, contracts, testing, delivery)
- `security` — 审查安全性 (threat model, input validation, secrets, injection, authz)

`methodology` — `auto` (default) or one of `superpower`, `langgpt`, `aishort`,
`prompt-optimizer`. `auto` lets the host pick and explain the choice. The four fragments
are distilled from four public projects (see `docs/research/prompt-sources.md`):
`superpower` = obra/superpowers (MIT), `langgpt` = langgptai/LangGPT (Apache-2.0 per the
GitHub API; its README badge says MIT — conflict recorded in the research notes),
`aishort` = rockbenben/ChatGPT-Shortcut (MIT code, community cards),
`prompt-optimizer` = linshenkx/prompt-optimizer (custom licence, not MIT).

## HTTP API (host)

All responses are JSON unless noted. Errors use `{ ok: false, error: { code, message } }`
with an appropriate status. The route sits outside the harness `/api/*` auth middleware,
so every write must be guarded by loopback + same-origin + JSON content-type checks
(same three gates as `dsh-workbuddy2api-hub`).

### `GET /prompt-enhance/api/state`

```json
{
  "ok": true,
  "version": "1.0.0",
  "provider": "workbuddy2api-hub",
  "model": "deepseek-v4.1-flash",
  "modelSource": "session-default",
  "workspace": { "root": "C:\\...\\default-workspace", "source": "config|registry|session|cwd" },
  "limits": { "maxPromptChars": 12000, "maxWorkspaceFiles": 40, "maxWorkspaceBytes": 60000 },
  "modes": [
    { "id": "code", "label": "代码", "variants": [
        { "id": "code-read", "label": "读取工作区后优化", "hint": "先扫描工作区再改写" },
        { "id": "code-only", "label": "仅按提示词优化", "hint": "不读代码，按开发类型补全" } ] },
    { "id": "creative", "label": "创作", "variants": [
        { "id": "creative-rich", "label": "补充丰富型", "hint": "润色 + 扩写" },
        { "id": "creative-structure", "label": "结构严谨型", "hint": "结构化/剧本化" } ] }
  ],
  "focuses": [
    { "id": "framework", "label": "完善开发框架", "hint": "模块划分、接口契约、测试与交付" },
    { "id": "security", "label": "审查安全性", "hint": "威胁模型、输入校验、注入面与密钥" }
  ],
  "methodologies": [
    { "id": "auto", "label": "自适应（推荐）", "hint": "按类型与内容自动选择" },
    { "id": "superpower", "label": "Superpowers", "hint": "…", "source": "https://github.com/obra/superpowers", "license": "MIT", "principles": ["…"] },
    { "id": "langgpt", "label": "LangGPT 结构化提示词", "hint": "…", "source": "…", "license": "Apache-2.0", "principles": ["…"] },
    { "id": "aishort", "label": "AiShort 提示词库", "hint": "…", "source": "…", "license": "MIT", "principles": ["…"] },
    { "id": "prompt-optimizer", "label": "Prompt Optimizer", "hint": "…", "source": "…", "license": "unknown", "principles": ["…"] }
  ],
  "client": { "beats": 3, "recent": [{ "at": 1761, "event": "dock-mounted", "detail": "hooks-ok" }] }
}
```

`client` is a diagnostic tail: the browser half posts breadcrumbs to `POST /presence`
(`client-apply`, `dock-mounted`, `panel-open`, `enhance-start`, `insert`) so a maintainer can
confirm the UI actually mounted without a browser console. It never influences enhancement.

`model` may be empty when no provider is resolvable; the client must then show a
readable hint and still let the user open the panel.

### `GET /prompt-enhance/api/workspace?refresh=1&cwd=…`

Scans the workspace (bounded) and returns the preview plus static security findings.
`cwd` is the absolute directory the browser thinks the session lives in; it wins over the
configured/registry root when it is an existing directory (`source: "session"`).
`refresh=1` bypasses the 10 s digest cache.

```json
{
  "ok": true,
  "root": "C:\\...\\default-workspace",
  "cwd": "C:\\...\\default-workspace",
  "fileCount": 173,
  "totalBytes": 481230,
  "truncated": false,
  "files": ["prompt-enhance/index.js", "src/app.ts"],
  "ignored": ["node_modules", ".git", "dist"],
  "security": {
    "findings": [
      { "rule": "dangerous-eval", "path": "a.js", "line": 12, "snippet": "eval(userInput)" }
    ],
    "scanned": 173
  },
  "durationMs": 21
}
```

### `POST /prompt-enhance/api/enhance` — `text/event-stream`

Request body:

```json
{
  "prompt": "给结算页加一个优惠券输入框",
  "mode": "code",
  "variant": "code-read",
  "focus": ["framework", "security"],
  "methodology": "auto",
  "cwd": "C:\\optional\\absolute\\path",
  "sessionId": "optional-session-id"
}
```

Validation errors (400/413/415) are plain JSON. A successful call switches to SSE with
`Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

Events (each `data:` line is one JSON object; a `: ping` comment is sent every 10 s):

| event | data |
| --- | --- |
| `meta` | `{ provider, model, modelSource, promptChars, mode, variant, focus, methodology, methodologyLabel, methodologyReason, workspaceRoot, workspaceSource, workspaceFiles, workspaceScanned, securityFindings, startedAt }` |
| `status` | `{ stage: "reasoning", chars }` (throttled to one per ~1.2 s) or `{ stage: "text", chars: 0 }` on the first visible token |
| `delta` | `{ text }` |
| `done` | `{ text, usage, finish, durationMs, truncated }` |
| `error` | `{ code, message }` — `upstream-failed` or `empty-result` |

The host aborts the model call when the HTTP request closes.

### `POST /prompt-enhance/api/cancel`

Optional `{}` body; aborts the newest in-flight enhancement of that process. Not required
by the UI (the client aborts its fetch instead) but useful for debugging.

### `POST /prompt-enhance/api/presence`

Diagnostic only: `{ "event": "dock-mounted", "detail": "hooks-ok" }` appends one breadcrumb
to the in-memory ring (24 entries) that `GET /state` echoes under `client`. The client calls
it with `keepalive: true` and ignores failures.

## Client responsibilities (`client.js`)

`window.__ModuleLoader__.load({ id: 'dsh-prompt-enhance', factory(require) { ... } })`,
factory returns `{ inject: ['slots'], apply(ctx) { ... } }` and registers one component on
`conversation.input.right` with `{ name: 'conversation.input.right', id: 'prompt-enhance-trigger', order: 20 }`.
That slot is the composer control row and renders for both the hero composer and an active
session, unlike `conversation.composer.dock`, which is hidden in some composer variants.

Props available to a session-scoped slot component:

- `useInput(selector)` — snapshot of the composer: `{ draft, draftRev, attachmentIds, phase, ... }`
- `inputActions` — `{ captureInsertion(), insertText(text, span), setDraft(text), persistDraft(), ... }`
- `sessionId`, `t`, `renderSlot`, `useSession`, `useConversation`

UI requirements:

1. A compact pill button in the composer control row (`✨ 提示词增强`). It stays clickable
   even with an empty draft — the panel explains what is missing — and is only disabled
   while an enhancement is running and the panel is closed.
2. Clicking opens a popover panel anchored above the button:
   - 代码 / 创作 tab switch.
   - Variant cards (radio behaviour) per the vocabulary above.
   - Code mode: focus checkboxes (`framework`, `security`), at least one required.
   - Methodology select (`auto` first) with the hint text.
   - Workspace preview line for `code-read`: file count + "预览/刷新" that calls the
     workspace endpoint and shows the first few paths.
   - Primary `开始增强` button; while running a `停止` button plus streaming text.
   - Result step: editable textarea with the enhanced prompt and
     `替换输入框` (`setDraft`), `插入到光标` (`insertText` with the span captured at
     start when `span.draftRev === currentDraftRev`), `复制`, `再试一次`.
3. Never read another plugin's DOM, never touch `document.body`, never install a global
   key handler; Escape closes the panel when it is open, click-outside closes it too.
4. All colours/spacing from `--dsw-alias-*` tokens with neutral fallbacks; class names
   prefixed `dpe-`; inline `<style>` injected once by the component (removed on unmount).
5. Chinese UI text (this build targets zh users); keep strings in one `LABELS` object.
