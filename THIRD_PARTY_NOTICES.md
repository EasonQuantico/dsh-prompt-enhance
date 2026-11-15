# Third-party notices

This plugin's methodology layer is **distilled from four public prompt-engineering
projects after reading their repositories**. No upstream source file, prompt card or
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

The **automatic mode's act roles** (`ACT_ROLES` in `strategies.js`) add a fifth source:

| Feature | Upstream project | Licence as observed | What was distilled |
| --- | --- | --- | --- |
| Ten act roles (Code Reviewer, QA Tester, Security Auditor, Architect, Tech Writer, Screenwriter, Novelist, Copy Editor, Translator, Summarizer) | [f/prompts.chat](https://github.com/f/prompts.chat) | `NOASSERTION` on GitHub — the cards carry per-author CC BY-NC terms | Only the *technique* each card demands (e.g. "a review must grade every change with acceptance criteria", "a screenplay starts from a one-line story then lands scene cards"); every role brief is our own Chinese wording, no card text is quoted |

## Notes on licence compatibility

- This repository is MIT. Techniques and ideas are not copyrightable; no upstream code
  or prompt text is included, so the stricter upstream terms (Apache-2.0, or the
  `NOASSERTION` state of `prompt-optimizer`) do not relicense this work.
- prompts.chat's cards are CC BY-NC: even technique paraphrases stay on the safe side only
  when no expression is copied. `ACT_ROLES` therefore contains no card text, no card
  titles-as-phrases, and no translations of card bodies — the role names match the acts
  only to make the provenance traceable, and the research notes record which cards were
  read. If you redistribute this plugin into a commercial product, re-check that usage
  against the upstream licences yourself.
- Attribution is kept in the source header of `strategies.js`, in the plugin UI
  (methodology tooltip shows source and licence), and in this file.
- The LangGPT discrepancy is recorded rather than resolved: the GitHub API licence
  endpoint and the README badge disagree. If you plan to redistribute LangGPT-derived
  text, verify the licence yourself first.
- The DSH host itself, its client bundles and its design tokens are **not** redistributed
  here. This repository only ships a plugin that loads inside a DSH installation.
