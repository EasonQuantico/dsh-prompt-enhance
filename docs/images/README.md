# docs/images

README 里用到的图，两类：

- **四张 PNG 是界面示意（mockup）**，不是运行截图。它们按 `client.js` 的真实槽位、文案（`LABELS`）、
  配色（`--dsw-alias-*`）绘制，用来解释按钮在哪、面板有什么、结果怎么落盘。
- **四张 SVG 是示意图**，纯手写矢量，用于链路、打分矩阵与证据装配。

| 文件 | 用在哪 | 生成脚本 |
| --- | --- | --- |
| `ui-composer.png` | README 顶部 hero、`界面一览 / At a glance` | `generate-mockups.py` |
| `ui-panel.png` | 面板 idle 态（代码大类）：三个大类 tab / 两种方式 / 方向 / 方法论 / 工作区 | `generate-mockups.py` |
| `ui-panel-doc.png` | 面板「文档」大类态：读文档后补写 / 按类型起草、文档信息块（字数、标题数、大纲、候选下拉、刷新）、方法论与增强按钮 | `generate-mockups.py` |
| `ui-result.png` | 面板 done 态：可编辑结果、四种落盘、元信息 | `generate-mockups.py` |
| `architecture.svg` | 一次增强的完整链路（浏览器半 ↔ 宿主半） | `generate-diagrams.py` |
| `methodology.svg` | 四方式 × 四方法论的加权矩阵 | `generate-diagrams.py` |
| `evidence.svg` | 工作区证据 → 只读证据块 | `generate-diagrams.py` |
| `doc-evidence.svg` | 文档证据 → `## 文档摘要` 块，右侧标出 doc-fill 的交付约束 | `generate-diagrams.py` |

## 重新生成

```bash
python3 generate-diagrams.py            # 纯标准库，无依赖
python3 -m pip install --user pillow    # mockup 需要 Pillow
python3 generate-mockups.py
```

`generate-mockups.py` 会按顺序找系统中的中文 UI 字体（Windows `Microsoft YaHei`、macOS `PingFang`、
Linux `Noto Sans CJK`）。找不到时用环境变量显式指定：

```bash
PE_FONT_UI=/path/NotoSansCJK-Regular.ttc \
PE_FONT_UI_BOLD=/path/NotoSansCJK-Bold.ttc \
PE_FONT_MONO=/path/DejaVuSansMono.ttf \
python3 generate-mockups.py
```

两张脚本都输出 2× 像素（便于在高分屏和 GitHub 上清晰显示），PNG 尺寸见脚本里的 `SCALE`。

## 改动约定

- 图里的文案必须和 `client.js` 的 `LABELS`、`strategies.js` 的 `MODES` / `FOCUSES` /
  `methodologyCatalogue()` 保持一致，否则图会与实际界面脱节。
- 图的批注编号（①②③…）要和两份 README 里对应小节的列表编号一致。
- 这些图片不参与 npm 打包（`package.json` 的 `files` 未包含 `docs/images`），只服务 GitHub 上的阅读。
