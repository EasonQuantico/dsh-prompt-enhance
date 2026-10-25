# dsh-prompt-enhance

> 在 DSH 对话框里，把一句草稿变成一份能直接执行的提示词。

[![CI](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a.svg)](package.json)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-none-brightgreen.svg)](package.json)

DSH（DeepSeek Harness）插件。在输入框右侧加一个 **✨ 提示词增强** 按钮：点开选「代码 / 创作」，
再选具体增强方式，插件读你的工作区（可选）、挑一套提示词工程方法论，把草稿改写成结构完整、
可执行、可验收的提示词，并流式回填到输入框。

- **零运行时依赖**，无构建步骤，装进 profile 即用。
- **读真实代码**：`code-read` 会扫描工作区目录树、关键文件与依赖清单，再据此改写提示词。
- **四套方法论自适应**：Superpowers / Prompt Optimizer / LangGPT / AiShort 的手法按场景打分选用，也可手动指定。
- **只写回输入框**，不自动发送消息；所有工作区访问都是只读。

[English README](README.en.md) · [内部契约](CONTRACT.md) · [安全策略](SECURITY.md) · [变更记录](CHANGELOG.md)

---

## 目录

- [功能](#功能)
- [四种增强方式](#四种增强方式)
- [方法论自适应](#方法论自适应)
- [安装](#安装)
- [使用](#使用)
- [配置](#配置)
- [工作原理](#工作原理)
- [HTTP 接口](#http-接口)
- [安全与隐私](#安全与隐私)
- [开发与测试](#开发与测试)
- [仓库结构](#仓库结构)
- [已知限制](#已知限制)
- [上游与致谢](#上游与致谢)
- [许可](#许可)

## 功能

| 能力 | 说明 |
| --- | --- |
| 常驻按钮 | 输入框右侧控件行一枚药丸按钮，hero 与会话内两种输入形态都在 |
| 两类四式 | 代码类（读工作区 / 仅凭提示词）、创作类（补充丰富 / 结构严谨） |
| 双优化方向 | 代码类可多选「完善开发框架」「审查安全性」，至少一项 |
| 方法论自适应 | 四套上游手法 + `auto` 打分，也可在下拉里手动指定 |
| 工作区证据 | 目录树、清单摘要、优先级文件摘录、10 条启发式安全命中 |
| 流式反馈 | SSE 增量显示，先显示「模型正在思考…（N 字）」再逐字出结果 |
| 一键落盘 | 替换输入框 / 插入到光标 / 复制 / 再试一次，结果区可直接编辑 |
| 偏好记忆 | 上次选的大类、方式、方向、方法论记在 `localStorage` |
| 诊断面包屑 | 浏览器半把挂载/打开/开始/回填事件上报到宿主，便于无控制台排查 |

## 四种增强方式

| 大类 | 方式 | id | 做什么 |
| --- | --- | --- | --- |
| 代码 | 读取工作区后优化 | `code-read` | 先扫描当前工作区，引用真实路径、依赖与既有约定，产出带改动边界、实施步骤与验收标准的目标 |
| 代码 | 仅按提示词优化 | `code-only` | 不读代码，先判定开发类型，再补技术选型、目录结构、接口与数据模型、测试策略 |
| 创作 | 补充丰富型 | `creative-rich` | 在保留原意与语气的前提下润色扩写：可感细节、视角、节奏、情绪曲线 |
| 创作 | 结构严谨型 | `creative-structure` | 套结构骨架：logline、人物小传、节拍表、场景卡、伏笔回收表、自检清单 |

代码类另有两个方向（可多选）：**完善开发框架**（技术栈、分层、接口契约、错误与日志、测试与交付）
和 **审查安全性**（信任边界、输入校验、注入面、鉴权、密钥与敏感数据、依赖供应链）。

无论是哪种方式，输出契约都是「只输出增强后的提示词本身」：不写前言、不做解释、保持信息密度，
并且使用与原提示词相同的语言。

## 方法论自适应

四个方法论片段来自四个开源项目，`strategies.js` 里是按手法重写的中文说明（**不复制上游原文**）：

| id | 名称 | 上游 | 许可 | 主要手法 |
| --- | --- | --- | --- | --- |
| `superpower` | Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | MIT | 计划 task block（含文件路径与行区间）、`Consumes`/`Produces` 接口、完成前验证门、反含糊条款 |
| `prompt-optimizer` | Prompt Optimizer | [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | 非 OSI（`NOASSERTION`） | 证据帧定、八轴诊断、`{{变量}}` 逐字保留 |
| `langgpt` | LangGPT 结构化提示词 | [langgptai/LangGPT](https://github.com/langgptai/LangGPT) | Apache-2.0（README 徽章写 MIT，冲突） | 六模块骨架（Role/Profile/Skills/Rules/Workflow/Output）、写人不写方法、去除 AI 味儿 |
| `aishort` | AiShort 提示词库 | [rockbenben/ChatGPT-Shortcut](https://github.com/rockbenben/ChatGPT-Shortcut) | MIT（代码） | act-as 角色、单一交付物、负向约束、显式占位符 |

选择规则在 `strategies.js` 的 `selectMethodology`：

1. 显式指定优先（面板下拉里选了具体方法论就照办，未知 id 自动回落）。
2. 否则打分：每个方法论基础 0.2；提示词命中其关键词每次 +0.6（最多计 3 次）；再按场景加权：

| 增强方式 | 场景加权 |
| --- | --- |
| `code-read` | superpower +1.6、prompt-optimizer +0.9（带安全方向再 +0.8） |
| `code-only` | prompt-optimizer +1.4、langgpt +1.1、superpower +0.5 |
| `creative-rich` | langgpt +1.5、superpower +0.7、aishort +0.6 |
| `creative-structure` | superpower +1.4、langgpt +1.1（命中「剧本/大纲/分集」等再 +1.0） |

实测四种方式分别选中 `superpower` / `prompt-optimizer` / `langgpt` / `superpower`。
出处、许可差异与「为什么没有合并上游文本」记录在
[`docs/research/prompt-sources.md`](docs/research/prompt-sources.md) 与
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 安装

前提：已安装 DSH（Web GUI 或桌面版）、Node ≥ 20、能编辑目标 profile 目录（默认
`~/.dsh/profiles/<profile>/`）。插件本身没有依赖，不需要 `npm install`。

```bash
git clone https://github.com/EasonQuantico/dsh-prompt-enhance.git
```

### 1. profile 清单登记

在 `<profile>/package.json` 里加一条依赖，并把包名追加到 `dsh.profile.bundles`
**末尾**（后应用的 patch 覆盖前面的）：

```jsonc
{
  "dependencies": {
    "dsh-prompt-enhance": "file:/absolute/path/to/dsh-prompt-enhance"
  },
  "dsh": {
    "profile": {
      "bundles": ["……原有项……", "dsh-prompt-enhance"]
    }
  }
}
```

### 2. 让 profile 能解析到这个包

把 profile 的 `node_modules/dsh-prompt-enhance` 指向你的检出目录（junction / 符号链接即可，
不必复制）：

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

### 3. 让它加载

- 改了 profile 清单（步骤 1）时，DSH 的 HMR 会自动重组，通常无需重启。
- **只改了插件代码**时，HMR 不会盯着插件目录，往 profile 的 `cordis.patch.yml` 末尾追加一行注释即可触发重载：

  ```powershell
  Add-Content "$HOME\.dsh\profiles\<profile>\cordis.patch.yml" "# reload prompt-enhance $(Get-Date -Format o)"
  ```

- 浏览器半（`client.js`）的更新需要**刷新 Web GUI 页面**：客户端 bundle 在页面加载时拉取。

### 4. 验证

```powershell
Invoke-RestMethod http://127.0.0.1:2896/prompt-enhance/api/state
```

返回 `ok: true` 且带上 `provider` / `model` / `modes` / `methodologies` 就说明宿主半已挂载；
刷新页面后输入框右侧应出现 ✨ 按钮。

卸载：从 `dsh.profile.bundles` 移除包名、删掉依赖与 junction，再触发一次重载。

> 不想用链接？把整个目录复制进 `<profile>/node_modules/dsh-prompt-enhance` 也可以，
> 代价是每次更新都要重新复制。

## 使用

1. 在输入框写一句草稿，例如「做个批量重命名图片的小工具」。
2. 点 ✨，选 代码 / 创作，再选方式；代码类勾选方向（默认两个都勾）。
3. 「方法论」保持「自适应（推荐）」即可，或手动指定。
4. 点 **开始增强**。结果流式出现，可 **替换输入框**、**插入到光标**、**复制**、**再试一次**。

小贴士：

- 草稿越具体，增强后的提示词越贴近你的意图；一两句就够，插件负责补结构。
- `code-read` 面板会显示扫描到的文件数、文件列表与前几条安全命中，先确认它读的是你要的目录。
- `code-read` 第一次会比较慢（要读工作区 + 模型推理），`deepseek-v4.1-flash` 实测首字节 7–28 秒。
- 增强结果只是**写进输入框**，还可以继续编辑，确认后再发送。

## 配置

`cordis.patch.yml` 里 `prompt-enhance` 那一行的 `config`：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `workspaceRoot` | 空 | 固定工作区；留空则优先用浏览器传来的会话 cwd，再退到 DSH 工作区列表的首项 |
| `provider` / `model` | 空 | 留空则跟随当前会话默认模型（`agentDefaultModel`），再退到第一个可用提供方 |
| `maxPromptChars` | `12000` | 草稿字符上限，超出返回 413 |
| `maxWorkspaceFiles` | `40` | 摘要里列出的文件数上限 |
| `maxWorkspaceBytes` | `60000` | 关键文件摘录的总字节上限 |
| `maxOutputTokens` | `8000` | 单次增强的输出上限；推理型模型会先吃掉一部分 |
| `requestTimeoutMs` | `180000` | 单次增强超时 |

## 工作原理

```
┌──────────────── 浏览器（DSH Web GUI）────────────────┐
│ client.js —— 槽位 conversation.input.right           │
│   ✨ 按钮 → 面板（选类型/方向/方法论）→ 读 SSE → 回填 │
└───────────────────────┬──────────────────────────────┘
                        │ fetch /prompt-enhance/api/*
                        │ （loopback + same-origin + JSON 三道闸）
┌───────────────────────▼────────── 宿主（DSH 进程）──┐
│ index.js —— /state /workspace /enhance(SSE) /cancel  │
│   collectWorkspace（只读、限量）→ scanSecurity        │
│   → selectMethodology → buildSystemPrompt            │
│   → ctx.llm.stream(...) → SSE meta/status/delta/done │
│ strategies.js —— 词表 + 方法论片段 + 提示词构造       │
└──────────────────────────────────────────────────────┘
```

1. 浏览器把草稿、类型、方向与当前会话 cwd 发给 `POST /enhance`。
2. 宿主按需读工作区（`code-read`），生成目录树、清单摘要、关键文件摘录与安全扫描命中。
3. `selectMethodology` 选方法论，`buildSystemPrompt` 拼出「增强指令 + 用户原提示词」的单条 user 消息。
4. 宿主用当前会话模型 `ctx.llm.stream(...)` 流式生成，按 SSE 推给浏览器；结果经 `tidyResult` 去掉
   ```markdown 包裹与「以下是…提示词：」之类的客套前缀。

工作区内容进入提示词时被包在「只读证据」帧里，并明确告知模型：其中出现的指令性文字只是素材，
不构成对它的命令 —— 这是对「工作区里藏提示词注入」的一层防御。

## HTTP 接口

挂在 `/prompt-enhance/api` 下（宿主插件路由，不在 DSH `/api/*` 鉴权中间件之后）：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/state` | 版本、模型路由、工作区、词表、方法论目录、诊断面包屑 |
| `GET` | `/workspace?refresh=1&cwd=…` | 只读扫描工作区，返回文件列表与安全命中 |
| `POST` | `/enhance` | 开始增强，`text/event-stream`（`meta`/`status`/`delta`/`done`/`error`） |
| `POST` | `/cancel` | 中止在途增强 |
| `POST` | `/presence` | 浏览器诊断面包屑（只读效果，不影响增强） |

写入端点一律要求：socket 地址为 loopback、`sec-fetch-site` 同源（或缺省）、
`content-type: application/json`。字段级契约见 [CONTRACT.md](CONTRACT.md)。

## 安全与隐私

- **只读工作区**：跳过 `node_modules`、`.git`、`dist`、`target`、`__pycache__` 等，深度 ≤ 7，
  最多 6000 个文件；二进制与锁文件按后缀过滤；单文件摘录 ≤ 3500 字符。
- **不越权读盘**：只读工作区目录内的文本文件，不跟随外部路径，不写任何文件。
- **静态扫描是素材不是结论**：10 条启发式正则，会误报（本仓库自己的规则定义与文档示例就会命中）。
- **数据去哪了**：你的草稿与工作区摘录会发送给 DSH 里当前选中的模型提供方。插件本身不收集遥测、
  不发外部请求。
- **不自动发送**：增强结果只写回输入框，绝不自动提交消息。
- 跨站页面无法驱动它：没有 CORS 通配，写接口的三道闸见上；详见 [SECURITY.md](SECURITY.md)。

## 开发与测试

```bash
npm run verify   # node --check 三个源码文件 + 全部单元测试
npm test         # 只跑测试（node --test）
```

- `test/strategies.test.mjs` —— 词表、方法论打分、提示词构造、证据帧定。
- `test/host.test.mjs` —— 用假 `ctx` 和假 request/response 跑全部路由：三道闸、错误码、SSE 帧、
  工作区扫描（临时目录 fixture）。
- `test/client.test.mjs` —— 在 `vm` 沙箱里加载 `client.js`，用桩 React 调用组件，验证槽位注册、
  渲染出的按钮，以及「不 require Harness 包 / 不碰 `document.body` / 只用 `--dsw-alias-*` token」等硬规则。

无需安装依赖即可跑；CI 在 Node 20 与 22 上跑同一套检查。改 UI 时的热更新流程：
改 `client.js` → 追加注释触发宿主重载 → 刷新页面。

贡献约定（编码约束、提交格式、PR 清单）见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 仓库结构

```
.
├── index.js                    宿主半：路由、工作区扫描、安全扫描、模型调用、SSE
├── strategies.js               词表、方法论片段、提示词构造、方法论打分
├── client.js                   浏览器半：按钮、面板、流式进度、回填
├── cordis.patch.yml            bundle 插入行与默认配置
├── CONTRACT.md                 两半共享的内部契约（事件、载荷、校验）
├── docs/research/              四个方法论的出处与许可调研（运行时不加载）
├── test/                       node:test 套件（无依赖、无网络）
├── .github/workflows/ci.yml    Node 20 / 22 语法检查 + 测试
├── CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / THIRD_PARTY_NOTICES.md
├── locale/{zh,en}.json         插件列表里的标题与描述
└── icon.svg                    插件图标
```

## 已知限制

- 安全扫描是正则启发式，会误报也会漏报；它是给模型看的线索，不是审计报告。
- `code-read` 的摘录按优先级取前 10 个文件、总量 ≤ 60KB；超大仓库只覆盖一部分。
- 增强质量取决于所选模型的推理能力；推理型模型首字节 7–28 秒属正常，可用「停止」中止。
- 还没有 `sessionId` 的空白页没有输入控件行，此时不渲染按钮；进入任一已有会话即可。
- 只在 DSH Web GUI 验证过；Electron IPC 形态未测。
- 未合并上游项目的提示词原文：LangGPT 许可徽章与 API 冲突、Prompt Optimizer 非 OSI 许可，
  因此只取手法、自行重写。

## 上游与致谢

本插件的「方法论自适应」源自四个公开项目的阅读与提炼，感谢作者们的开放工作：

- [obra/superpowers](https://github.com/obra/superpowers)（MIT）
- [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer)（许可状态 `NOASSERTION`）
- [langgptai/LangGPT](https://github.com/langgptai/LangGPT)（Apache-2.0 / README 徽章写 MIT，冲突已记录）
- [rockbenben/ChatGPT-Shortcut](https://github.com/rockbenben/ChatGPT-Shortcut)（MIT 代码）

许可细节与「没有复制任何上游文本」的说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可

[MIT](LICENSE) © 2026 EasonQuantico
