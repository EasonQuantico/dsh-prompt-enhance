# dsh-prompt-enhance

> 在 DSH 对话框里，把一句草稿变成一份能直接执行的提示词。

[![CI](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/EasonQuantico/dsh-prompt-enhance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a.svg)](package.json)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-none-brightgreen.svg)](package.json)

DSH（DeepSeek Harness）插件。在输入框右侧加一个 **✨ 提示词增强** 按钮：点开选「代码 / 创作 /
文档」，再选具体增强方式与篇幅档位，插件读你的工作区（可选）、挑一套提示词工程方法论，把草稿
改写成结构完整、可执行、可验收的提示词，并流式回填到输入框。

- **零运行时依赖**，无构建步骤，装进 profile 即用。
- **读真实代码**：`code-read` 会扫描工作区目录树、关键文件与依赖清单，再据此改写提示词。
- **四套方法论自适应**：Superpowers / Prompt Optimizer / LangGPT / AiShort 的手法按场景打分选用，也可手动指定。
- **三档篇幅**：简洁 / 默认 / 严谨，同一请求可以只留三行，也可以给到完整结构与验收清单。
- **只写回输入框**，不自动发送消息；所有工作区访问都是只读。

![提示词增强按钮：输入框右侧的 ✨ 按钮，点开选代码/创作/文档、增强方式与篇幅档位](docs/images/ui-composer.png)

[English README](README.en.md) · [内部契约](CONTRACT.md) · [安全策略](SECURITY.md) · [变更记录](CHANGELOG.md)

---

## 目录

- [功能](#功能)
- [界面一览](#界面一览)
- [三种增强方式](#三种增强方式)
- [档位：三种篇幅](#档位三种篇幅)
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
| 三类六式 | 代码类（读工作区 / 仅凭提示词）、创作类（补充丰富 / 结构严谨）、文档类（读文档后补写 / 按类型起草） |
| 双优化方向 | 代码类可多选「完善开发框架」「审查安全性」，至少一项 |
| 三档篇幅 | 简洁 / 默认 / 严谨：同一请求按档位给字数预算，四家方法论各自按实测比例缩放 |
| 方法论自适应 | 四套上游手法 + `auto` 打分，也可在下拉里手动指定 |
| 工作区证据 | 目录树、清单摘要、优先级文件摘录、10 条启发式安全命中 |
| 文档框架 | 文档类先读标题大纲与格式特征（层级、表格、列表、编号、段落长度），补写不越出原结构 |
| 流式反馈 | SSE 增量显示，先显示「模型正在思考…（N 字）」再逐字出结果 |
| 一键落盘 | 替换输入框 / 插入到光标 / 复制 / 再试一次，结果区可直接编辑 |
| 偏好记忆 | 上次选的大类、方式、方向、档位、方法论、文档记在 `localStorage` |
| 诊断面包屑 | 浏览器半把挂载/打开/开始/回填事件上报到宿主，便于无控制台排查 |

## 界面一览

> 下面五张图里，四张界面示意按 `client.js` 的真实布局与文案绘制，是**示意**而非运行截图；
> 最后一张是文档摘要的证据结构图。图中的路径、文件名与模型名仅作示例。

### 按钮：常驻输入框右侧

![输入框右侧控件行里的「✨ 提示词增强」按钮](docs/images/ui-composer.png)

- **① 只写回输入框** —— 增强结果落到草稿里，不替你发送；写回前还可以继续编辑。
- **② 常驻按钮** —— 挂在 `conversation.input.right` 槽位，hero（新建会话）与会话内两种输入形态都在；
  草稿为空也能点，因为它增强的是「你接下来要写的东西」。

### 面板：先定大类，再定方式与方向

![提示词增强面板：三类标签、方式卡片、优化方向、档位、方法论、工作区证据、开始按钮](docs/images/ui-panel.png)

- **① 先选大类** —— 代码 / 创作 / 文档；切换会记住各自上次用的方式。
- **② 六种增强方式** —— 每个大类两种，卡片上写着各自的增益。
- **③ 代码类再加方向** —— 完善开发框架 / 审查安全性，可多选、至少一项。
- **④ 方法论可自适应** —— 默认 `auto` 按场景打分，也可手动锁定某一家。
- **⑤ 工作区证据可见** —— 读取前就告诉你要扫哪、多少文件、几处安全命中。
- **⑥ 一句话启动** —— 在途时按钮变成「停止」；不自动发送：结果只回填输入框。
- **⑦ 档位独立于类型** —— 简洁 / 默认 / 严谨只管篇幅：同一个请求可以只留三行，也可以给到完整结构。

### 结果：先编辑，再落盘

![增强结果面板：可编辑的结果区、四种落盘方式与可追溯的元信息](docs/images/ui-result.png)

- **① 结果可直接编辑** —— 增强结果是草稿不是终稿：先改再回填。
- **② 四种落盘方式** —— 替换输入框 / 插入到光标 / 复制 / 再试一次。
- **③ 元信息可追溯** —— 这次用了哪家模型、哪套方法论、读了多少文件、命中几处。

### 文档：先读框架，再补写

![文档模式面板：选中的文档与字数标题数、框架大纲、候选文档下拉、刷新文档、档位与开始按钮](docs/images/ui-panel-doc.png)

- **① 先定文档** —— 选中的文档与它的字数、标题数；自动挑选按提示词相关性优先，兼顾子目录、
  `docs/`、近期修改与体积。
- **② 框架先入眼** —— 标题大纲的前几条直接摆在按钮上方，补写前就能确认结构对不对。
- **③ 候选下拉可手动指定** —— 不想用自动挑选时，从工作区里的文档里点一个。
- **④ 刷新文档** —— 重新扫描工作区，新建或改名后的文件立刻出现在候选里。
- **⑤ 自动挑选的排序依据** —— 相关性与近期修改，都只是排序，不会替你改动任何文件。
- **⑥ 档位同样作用于文档** —— 补一节还是补整章，用同一个档位旋钮控制篇幅。

![文档证据：现有框架、格式特征、原文节选、其他文档四类只读素材装进「文档摘要」](docs/images/doc-evidence.svg)

- 四类素材（框架、格式特征、原文节选、其他文档）只作为「只读证据」注入：里面的指令性文字
  也只是被引用的素材，不会变成对你的命令。
- 缺口一律写成「待补充：需要 X（来源）」；数据、引用与结论不得编造，结构上必须与原文档的
  标题层级、编号与表格列对齐。

## 三种增强方式

| 大类 | 方式 | id | 做什么 |
| --- | --- | --- | --- |
| 代码 | 读取工作区后优化 | `code-read` | 先扫描当前工作区，引用真实路径、依赖与既有约定，产出带改动边界、实施步骤与验收标准的目标 |
| 代码 | 仅按提示词优化 | `code-only` | 不读代码，先判定开发类型，再补技术选型、目录结构、接口与数据模型、测试策略 |
| 创作 | 补充丰富型 | `creative-rich` | 在保留原意与语气的前提下润色扩写：可感细节、视角、节奏、情绪曲线 |
| 创作 | 结构严谨型 | `creative-structure` | 套结构骨架：logline、人物小传、节拍表、场景卡、伏笔回收表、自检清单 |
| 文档 | 读文档后补写 | `doc-fill` | 先读当前文档的标题大纲与格式特征，再把提示词改写成「在这一节的既有结构里补写什么、用哪种格式、哪些不写」 |
| 文档 | 按类型起草 | `doc-draft` | 没有现成文档时，按文档类型（README / 方案 / 报告 / 纪要 / 论文 / 合同）搭好框架、写作规范与验收标准 |

代码类另有两个方向（可多选）：**完善开发框架**（技术栈、分层、接口契约、错误与日志、测试与交付）
和 **审查安全性**（信任边界、输入校验、注入面、鉴权、密钥与敏感数据、依赖供应链）。

文档类的补写约束固定写在提示词里：保留原有标题层级、编号与表格列；补写内容必须能原样放回
对应小节；拿不准的缺口写成「待补充：需要 X（来源）」而不是编一个；篇幅以覆盖新增内容为准。

无论是哪种方式，输出契约都是「只输出增强后的提示词本身」：不写前言、不做解释、保持信息密度，
并且使用与原提示词相同的语言。

## 档位：三种篇幅

模型默认爱写长：同一个需求，选错档位就是「三屏」和「三行」的差别。面板里的**档位独立于大类与
方式**，只回答一个问题——这次要写多长。

| 档位 | 定位 | superpower | prompt-optimizer | LangGPT | AiShort |
| --- | --- | --- | --- | --- | --- |
| 简洁 `concise` | 只留目标、硬约束与验收，约严谨档的三分之一 | 1428 字 | 1028 字 | 1057 字 | 785 字 |
| 默认 `default` | 分节但克制，约严谨档的三分之二 | 2688 字 | 1935 字 | 1989 字 | 1478 字 |
| 严谨 `thorough` | 完整结构、分步计划与验收清单 | 4200 字 | 3024 字 | 3108 字 | 2310 字 |

以 **Superpowers 的严谨档（4200 字）为标尺**：其余三家按各自实测成稿长度的比例缩放
（Prompt Optimizer 0.72、LangGPT 0.74、AiShort 0.55）。这样「严谨档的 AiShort」仍然比「严谨档的
Superpowers」短，而同一个档位在四家的含义一致——不会出现「选了简洁还是三屏」。

实测用的是同一个请求（桌面小工具批量重命名，`code-only`，`workbuddy2api-hub` /
`deepseek-v4.1-flash`），四家各跑两档：

| 档位 | superpower | prompt-optimizer | LangGPT | AiShort |
| --- | --- | --- | --- | --- |
| 严谨档成稿 | 5794 字 | 3906 字 | 4249 字 | 2901 字 |
| 简洁档成稿 | 1941 字 | 1466 字 | 1438 字 | 1149 字 |

两档之间实测约 1 : 3（超发系数约 1.3–1.5，四家一致），所以上表的数字是**预算**而不是承诺：
模型通常略超一点，但档位之间的相对差异稳定。

短档不只是把数字调小，它还会告诉模型**该先砍什么**：Superpowers 先合并计划步骤、再删接口表与
示例；LangGPT 先把 Role/Profile 合成一段、删 Examples；AiShort 只留角色、交付物与语言格式约束；
Prompt Optimizer 先删诊断段与对错对照示例。严谨档相反：完整结构，每步带产出与验证。

![三档篇幅：以 Superpowers 严谨档为标尺，逐档缩放到其余三家](docs/images/depth.svg)

三档都带一句「交稿前自检字数，超出按『示例 → 解释 → 重复要求 → 步骤细节』的顺序删」，文档类
另加「宁可按小节分批补写，也不要注水」。

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
| `doc-fill` | langgpt +1.5、prompt-optimizer +1.0、superpower +0.7（命中「表格/目录/编号/排版」再 +0.6；命中「数据/引用/出处」prompt-optimizer 再 +0.8） |
| `doc-draft` | langgpt +1.4、superpower +1.0、prompt-optimizer +0.8（提示词短于 90 字再 aishort +0.6） |

![方法论自适应：六种增强方式 × 四套方法论的加权矩阵](docs/images/methodology.svg)

实测六种方式依次选中 `superpower` / `prompt-optimizer` / `langgpt` / `superpower` /
`langgpt` / `langgpt`（后两种是文档类）。出处、许可差异与「为什么没有合并上游文本」记录在
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
- **只改了插件代码**时，HMR 不会盯着插件目录，往 profile 的 `cordis.patch.yml` 末尾追加一行注释即可触发重载
  （前提是上一步用的是链接；若 profile 里是副本，见下面的第 5 条）：

  ```powershell
  Add-Content "$HOME\.dsh\profiles\<profile>\cordis.patch.yml" "# reload prompt-enhance $(Get-Date -Format o)"
  ```

- 浏览器半（`client.js`）的更新需要**刷新 Web GUI 页面**：客户端 bundle 在页面加载时拉取。

### 4. 验证

```powershell
Invoke-RestMethod http://127.0.0.1:<port>/prompt-enhance/api/state
```

端口每次启动可能不同，以 Web GUI 的地址为准。返回 `ok: true` 且带上 `provider` / `model` /
`modes` / `methodologies` 就说明宿主半已挂载；刷新页面后输入框右侧应出现 ✨ 按钮。

卸载：从 `dsh.profile.bundles` 移除包名、删掉依赖与 junction，再触发一次重载。

> 不想用链接？把整个目录复制进 `<profile>/node_modules/dsh-prompt-enhance` 也可以，
> 代价是每次更新都要重新复制。

### 5. 更新插件后看不到新功能？

`dsh plugin install` / `pnpm install` 会把 `file:` 依赖**复制**进 profile 的 `node_modules`
（连文件的修改时间一起保留）。之后你改了检出目录里的代码，profile 里那份副本仍是旧的，
宿主重启也只会加载旧代码——症状是 `/prompt-enhance/api/state` 的 `version` 比
`package.json` 里的版本旧，`modes` 也缺了新加的大类。

确认与修复：

```powershell
$link = "$HOME\.dsh\profiles\<profile>\node_modules\dsh-prompt-enhance"
(Get-Item $link).LinkType          # 为空 = 真实目录（陈旧副本）；Junction 才是链接
Remove-Item $link -Recurse -Force
New-Item -ItemType Junction -Path $link -Target "C:\absolute\path\to\dsh-prompt-enhance"
Add-Content "$HOME\.dsh\profiles\<profile>\cordis.patch.yml" "# reload prompt-enhance $(Get-Date -Format o)"
```

等约 10 秒再看 `/state`：`version` 应等于 `package.json` 的版本，`modes` 里应出现
`code` / `creative` / `doc`。**宿主半不需要重启**——重载注释会重新 import 链接目录里的文件；
浏览器半再刷新一次页面即可。

## 使用

1. 在输入框写一句草稿，例如「做个批量重命名图片的小工具」。
2. 点 ✨，选 代码 / 创作 / 文档，再选方式；代码类勾选方向（默认两个都勾）。
3. 「方法论」保持「自适应（推荐）」即可，或手动指定。
4. 点 **开始增强**。结果流式出现，可 **替换输入框**、**插入到光标**、**复制**、**再试一次**。

小贴士：

- 草稿越具体，增强后的提示词越贴近你的意图；一两句就够，插件负责补结构。
- `code-read` 面板会显示扫描到的文件数、文件列表与前几条安全命中，先确认它读的是你要的目录。
- `code-read` 第一次会比较慢（要读工作区 + 模型推理），`deepseek-v4.1-flash` 实测首字节 7–28 秒。
- `doc-fill` 先看面板里的「文档」一行：路径对不对、字数与标题数是否是你想补写的那篇；
  自动挑选按提示词相关性排序，想换就展开下拉。草稿里写清「补哪一节、补什么」效果最好，
  例如「在 README 的『已知限制』里补上并发与超时两条」。
- 增强结果只是**写进输入框**，还可以继续编辑，确认后再发送。
- 档位按需选：**简洁** 适合只要骨架、后面自己填细节（也最省 token）；**严谨** 适合要把活交给别人
  或别的代理执行。档位只约束篇幅，不改方法论。

## 配置

`cordis.patch.yml` 里 `prompt-enhance` 那一行的 `config`：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `workspaceRoot` | 空 | 固定工作区；留空则优先用浏览器传来的会话 cwd，再退到 DSH 工作区列表的首项 |
| `provider` / `model` | 空 | 留空则跟随当前会话默认模型（`agentDefaultModel`），再退到第一个可用提供方 |
| `maxPromptChars` | `12000` | 草稿字符上限，超出返回 413 |
| `maxWorkspaceFiles` | `40` | 摘要里列出的文件数上限 |
| `maxWorkspaceBytes` | `60000` | 关键文件摘录的总字节上限 |
| `maxDocumentChars` | `16000` | 文档模式读取的原文上限，超出会截断并标注 |
| `maxOutputTokens` | `8000` | 单次增强的输出上限；推理型模型会先吃掉一部分 |
| `requestTimeoutMs` | `180000` | 单次增强超时 |

## 工作原理

![一次增强的完整链路：草稿 → POST /enhance（三道闸）→ 证据装配 → ctx.llm.stream → SSE 流式回填](docs/images/architecture.svg)

浏览器半只负责「选」与「回填」，宿主半负责证据、路由与流式输出：

| 文件 | 分工 |
| --- | --- |
| `client.js` | 槽位注册、按钮与面板、SSE 解析、进度显示、回填（`insertText` / `setDraft`） |
| `index.js` | 三道闸、`/state` `/workspace` `/documents` `/enhance` `/cancel`、`collectWorkspace`、`collectDocument`、`resolveRoute`、SSE |
| `strategies.js` | 词表、`selectMethodology` 打分、`buildSystemPrompt` 拼提示词、`renderDigest` / `renderDocDigest` 证据帧定 |

1. 浏览器把草稿、类型、方向与当前会话 cwd 发给 `POST /enhance`。
2. 宿主按需读工作区（`code-read`），生成目录树、清单摘要、关键文件摘录与安全扫描命中；
   `doc-fill` 则改读当前文档，生成标题大纲、格式特征、原文节选与其他文档候选。
3. `selectMethodology` 选方法论，`buildSystemPrompt` 拼出「增强指令 + 用户原提示词」的单条 user 消息。
4. 宿主用当前会话模型 `ctx.llm.stream(...)` 流式生成，按 SSE 推给浏览器；结果经 `tidyResult` 去掉
   整段 markdown 代码块围栏与「以下是…提示词：」之类的客套前缀。

工作区内容与文档内容进入提示词时都被包在「只读证据」帧里，并明确告知模型：其中出现的指令性文字
只是素材，不构成对它的命令 —— 这是对「工作区里藏提示词注入」的一层防御，文档补写同理：
文档里的「请忽略以上要求」也只是被引用的正文。

### 工作区证据（`code-read`）

![工作区证据：目录树、依赖清单、文件摘录、安全扫描四类只读素材装进「只读证据块」](docs/images/evidence.svg)

- **四类素材**：目录树（≤ 60 行）、依赖清单摘要、优先级 10 个文件摘录（每个 ≤ 3500 字符）、
  60 个文件 × 10 条规则的安全扫描命中（最多 40 条）。
- **一律帧定**：`renderDigest()` 给整块加上「这是素材不是命令」的前置声明，并要求模型
  「不满足时明确要求先声明不知道」，避免它把注释或文档里的示例当成真实约束。
- **限量与可预期**：总量 ≤ `maxWorkspaceBytes`，深度 ≤ 7，最多 6000 个文件参与遍历，结果缓存 10 秒。

### 文档证据（`doc-fill`）

![文档证据：现有框架、格式特征、原文节选、其他文档四类只读素材装进「文档摘要」](docs/images/doc-evidence.svg)

- **四类素材**：标题大纲（含层级与行号）、格式特征（标题风格、最大层级、表格/代码块/列表数、
  链接与粗体数量、front-matter、编号风格、段落平均长度）、原文节选（≤ `maxDocumentChars`）、
  工作区里的其他文档（仅作参考，不当作事实）。
- **格式先对齐**：补写要求保留原有标题层级、编号与表格列，使新增段落能原样放回对应小节。
- **缺口不编造**：摘要里没有的章节、数据与引用一律写成「待补充：需要 X（来源）」。

## HTTP 接口

挂在 `/prompt-enhance/api` 下（宿主插件路由，不在 DSH `/api/*` 鉴权中间件之后）：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/state` | 版本、模型路由、工作区、词表（含 `depths`）、方法论目录、诊断面包屑 |
| `GET` | `/workspace?refresh=1&cwd=…` | 只读扫描工作区，返回文件列表与安全命中 |
| `GET` | `/documents?refresh=1&cwd=…&prompt=…&path=…` | 列出可读文档，并给出将被读取那篇的标题大纲与格式特征 |
| `POST` | `/enhance` | 开始增强，`text/event-stream`（`meta`/`status`/`delta`/`done`/`error`）；请求体可带 `depth` |
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
- **文档不越界**：`docPath` 会被解析回工作区根内（越界返回 `doc-outside-root`），只接受文本后缀，
  二进制一律拒绝；文档正文同样包在只读证据帧里。
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

README 里的图在 `docs/images/`：四张界面示意 PNG 由 `generate-mockups.py`（Pillow）生成，
五张 SVG 由 `generate-diagrams.py` 与 `generate-depth.py`（纯标准库）生成，细节见
[docs/images/README.md](docs/images/README.md)。

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
├── docs/images/                README 的界面示意与架构图（含生成脚本，不参与打包）
├── test/                       node:test 套件（无依赖、无网络）
├── .github/workflows/ci.yml    Node 20 / 22 语法检查 + 测试
├── CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / THIRD_PARTY_NOTICES.md
├── locale/{zh,en}.json         插件列表里的标题与描述
└── icon.svg                    插件图标
```

## 已知限制

- 安全扫描是正则启发式，会误报也会漏报；它是给模型看的线索，不是审计报告。
- `code-read` 的摘录按优先级取前 10 个文件、总量 ≤ 60KB；超大仓库只覆盖一部分。
- 文档模式只读纯文本格式（`.md` / `.mdx` / `.txt` / `.rst` / `.adoc` / `.org` / `.tex`）；
  `.docx`、`.pdf` 不解析 —— 需要先转成文本，或改用「按类型起草」。
- 文档补写以原文节选为限（默认 ≤ 16000 字）；超长文档只覆盖前部，摘要里会标注「已截断」。
- 增强质量取决于所选模型的推理能力；推理型模型首字节 7–28 秒属正常，可用「停止」中止。
- 档位预算是指令不是硬约束：实测成稿约为预算的 1.3–1.5 倍（四家一致），档位之间的相对差异稳定，
  但别指望「简洁」一定落在 1428 字以内。
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
