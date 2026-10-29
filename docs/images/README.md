# docs/images

README 里用到的图，两类：

- **四张 PNG 是界面示意（mockup）**，不是运行截图。它们按 `client.js` 的真实槽位、文案（`LABELS`）、
  配色（`--dsw-alias-*`）绘制，用来解释按钮在哪、面板有什么、结果怎么落盘。
- **两张 PNG 是真截图**：`ui-language-zh.png` / `ui-language-en.png` 来自一次独立测试台运行
  （`.dsh-test-*` profile + headless Chrome 走 CDP），只裁了面板区域，没有改任何像素。
- **五张 SVG 是示意图**，纯手写矢量，用于链路、打分矩阵、证据装配与三档篇幅标尺。

| 文件 | 用在哪 | 生成脚本 |
| --- | --- | --- |
| `ui-composer.png` | README 顶部 hero、`界面一览 / At a glance` | `generate-mockups.py` |
| `ui-panel.png` | 面板 idle 态（代码大类）：三个大类 tab / 两种方式 / 方向 / 档位 / 方法论 / 工作区 | `generate-mockups.py` |
| `ui-panel-doc.png` | 面板「文档」大类态：读文档后补写 / 按类型起草、文档信息块（字数、标题数、大纲、候选下拉、刷新）、档位、方法论与增强按钮 | `generate-mockups.py` |
| `ui-result.png` | 面板 done 态：可编辑结果、四种落盘、元信息 | `generate-mockups.py` |
| `ui-language-zh.png` | `界面语言 / Interface language`：中文面板（真截图） | 无（截图，来自测试台） |
| `ui-language-en.png` | `界面语言 / Interface language`：English panel（真截图） | 无（截图，来自测试台） |
| `architecture.svg` | 一次增强的完整链路（浏览器半 ↔ 宿主半） | `generate-diagrams.py` |
| `methodology.svg` | 四方式 × 四方法论的加权矩阵 | `generate-diagrams.py` |
| `evidence.svg` | 工作区证据 → 只读证据块 | `generate-diagrams.py` |
| `doc-evidence.svg` | 文档证据 → `## 文档摘要` 块，右侧标出 doc-fill 的交付约束 | `generate-diagrams.py` |
| `depth.svg` | 三档篇幅标尺：简洁 / 默认 / 严谨 三段的预算条，Superpowers 严谨档（4200 字）为标尺，其余三家按实测比例缩放 | `generate-depth.py` |

## 重新生成

```bash
python3 generate-diagrams.py            # 纯标准库，无依赖
python3 generate-depth.py               # 纯标准库，无依赖
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

`generate-mockups.py` 输出 2× 像素（便于在高分屏和 GitHub 上清晰显示），尺寸见脚本里的 `SCALE`；
两个 SVG 脚本输出纯矢量，与分辨率无关，检查效果时用 2× 的 headless 截图即可。

## 改动约定

- 图里的文案必须和 `client.js` 的 `LABELS`、`strategies.js` 的 `MODES` / `FOCUSES` / `DEPTHS` /
  `methodologyCatalogue()` 保持一致，否则图会与实际界面脱节。
- `depth.svg` 的数字来自 `strategies.js` 的 `DEPTH_SCALE`（0.34 / 0.64 / 1）与实测长度比例；
  改预算时先改代码常量，再跑 `generate-depth.py`，别只改图。
- 图的批注编号（①②③…）要和两份 README 里对应小节的列表编号一致。
- 这些图片不参与 npm 打包（`package.json` 的 `files` 未包含 `docs/images`），只服务 GitHub 上的阅读。
