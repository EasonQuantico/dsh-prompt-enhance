# Third-party notices

This plugin's methodology layer is **distilled from four public prompt-engineering
projects, plus one skill repository, after reading their sources**. No upstream source file, prompt card or
prompt text was copied into this repository: every fragment in `strategies.js` is
written from scratch in Chinese, and only the *technique* (what the resulting prompt
should contain and how it should be graded) is reused.

The provenance notes with quotes, commit evidence and open questions live in
[`docs/research/prompt-sources.md`](docs/research/prompt-sources.md). The structured
research export lives in [`docs/research/methodology-fragments.mjs`](docs/research/methodology-fragments.mjs)
and is **not** loaded at runtime — `strategies.js` is the executed copy.

| Methodology id | Upstream project | Licence as observed | What was distilled |
| --- | --- | --- | --- |
| `superpower` | [obra/superpowers](https://github.com/obra/superpowers) | MIT | Plan task blocks with file paths and line ranges, explicit `Consumes`/`Produces` interfaces, a verification gate before "done", anti-vagueness clauses |
| `prompt-optimizer` | [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | No OSI licence (`NOASSERTION` on GitHub) | Evidence framing, eight-axis diagnosis, byte-exact preservation of `{{variable}}` placeholders |
| `langgpt` | [langgptai/LangGPT](https://github.com/langgptai/LangGPT) | Apache-2.0 per GitHub API; the repository README badge says MIT — **conflict, unresolved upstream** | Six-module skeleton (Role / Profile / Skills / Rules / Workflow / Output), "describe the person, not the method", de-AI-flavour checklist |
| `aishort` | [rockbenben/ChatGPT-Shortcut](https://github.com/rockbenben/ChatGPT-Shortcut) | MIT (code), community-contributed cards | `act-as` role framing, single deliverable, negative constraints, explicit placeholders |

The **automatic mode's concise route** (`buildConcisePrompt` in `strategies.js`) adds a fifth
source:

| Feature | Upstream project | Licence as observed | What was distilled |
| --- | --- | --- | --- |
| The "your words first, only add notes" method behind the concise candidate | [Samuel-Shek/prompt-optimizer-skill](https://github.com/Samuel-Shek/prompt-optimizer-skill) | MIT (v4.1.3) | The rule set: quote the user's request verbatim, put every addition in a subordinate notes block introduced by a fixed sentence, write only *how*, never invent bans/counts/acceptance criteria, mark gaps with `{{待填写：名称｜格式示例}}` placeholders, end with an optional "待确认" list. The Chinese rule text in `CONCISE_RULES` is our own rewriting; no line from the upstream `SKILL.md` is reproduced |

Earlier drafts of the automatic mode also shipped ten prompts.chat-derived "act roles". They were
removed in 1.5.3: the concise route covers the same need without touching a CC BY-NC corpus, so
`ACT_ROLES` no longer exists and no card technique is carried by this repository.

## Notes on licence compatibility

- This repository is MIT. Techniques and ideas are not copyrightable; no upstream code
  or prompt text is included, so the stricter upstream terms (Apache-2.0, or the
  `NOASSERTION` state of `prompt-optimizer`) do not relicense this work.
- The concise route's rules come from an MIT-licensed repository, but the upstream prompt text
  was still not copied: `CONCISE_RULES` is a Chinese rewrite of the method, which keeps this
  repository's own MIT terms clean and avoids any question about translating source material.
- prompts.chat (CC BY-NC) is no longer referenced by any shipped code path; it stays in
  `docs/research/prompt-sources.md` as reading history only.
- Attribution is kept in the source header of `strategies.js`, in the plugin UI
  (methodology tooltip shows source and licence), and in this file.
- The LangGPT discrepancy is recorded rather than resolved: the GitHub API licence
  endpoint and the README badge disagree. If you plan to redistribute LangGPT-derived
  text, verify the licence yourself first.
- The DSH host itself, its client bundles and its design tokens are **not** redistributed
  here. This repository only ships a plugin that loads inside a DSH installation.
