#!/usr/bin/env python3
"""Render the interface illustrations used by the README.

These images are *mockups*, not screenshots: they follow the real layout and
copy of `client.js` (the trigger in `conversation.input.right`, the panel's
tab / card / focus / depth / methodology / workspace rows, and the result area)
so the docs can show the shape of the UI without shipping screen captures of a
private workspace.

Requires Pillow (`pip install pillow`) and a CJK-capable font. On Windows the
default paths below (Microsoft YaHei, Consolas) are used; elsewhere point
`PE_FONT_UI`, `PE_FONT_UI_BOLD` and `PE_FONT_MONO` at local font files.

Usage: python docs/images/generate-mockups.py
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCALE = 2  # laid out in CSS pixels, rendered at 2x

BG = (17, 18, 20)
PANEL = (28, 30, 34)
PANEL_HI = (38, 41, 46)
FIELD = (22, 24, 27)
BORDER = (62, 66, 74)
BORDER_SOFT = (48, 51, 58)
TEXT = (236, 238, 241)
TEXT2 = (176, 181, 189)
TEXT3 = (128, 134, 143)
ACCENT = (88, 132, 255)
ACCENT_DIM = (32, 46, 90)
WARN = (233, 170, 94)
ANNO = (123, 130, 140)

FONT_CANDIDATES = {
    "ui": [
        os.environ.get("PE_FONT_UI", ""),
        r"C:\Windows\Fonts\msyh.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ],
    "bold": [
        os.environ.get("PE_FONT_UI_BOLD", ""),
        r"C:\Windows\Fonts\msyhbd.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    ],
    "mono": [
        os.environ.get("PE_FONT_MONO", ""),
        r"C:\Windows\Fonts\consola.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ],
}

_font_cache = {}


def font(kind, size):
    key = (kind, size)
    if key not in _font_cache:
        px = int(round(size * SCALE))
        loaded = None
        for path in FONT_CANDIDATES[kind]:
            if path and os.path.exists(path):
                try:
                    loaded = ImageFont.truetype(path, px)
                    break
                except OSError:
                    continue
        _font_cache[key] = loaded or ImageFont.load_default(px)
    return _font_cache[key]


def s(value):
    """CSS px -> device px."""
    return int(round(value * SCALE))


def is_wide(ch):
    return ord(ch) > 0x2E7F


def text_width(draw, value, f_ui, size=None):
    f_mono = font("mono", size) if size else f_ui
    return sum(draw.textlength(ch, font=(f_ui if is_wide(ch) else f_mono)) for ch in value)


def text(draw, x, y, value, f, fill=TEXT, anchor="la"):
    draw.text((x, y), value, font=f, fill=fill, anchor=anchor)


def mixed(draw, x, y, value, size, fill=TEXT):
    """Draw a line mixing a proportional CJK font with a monospace font."""
    f_ui = font("ui", size)
    f_mono = font("mono", size)
    cursor = x
    for ch in value:
        f = f_ui if is_wide(ch) else f_mono
        draw.text((cursor, y), ch, font=f, fill=fill)
        cursor += draw.textlength(ch, font=f)
    return cursor


def wrap_mixed(draw, value, size, max_width):
    """Wrap one logical line into visual lines, CJK-aware."""
    f_ui = font("ui", size)
    f_mono = font("mono", size)
    lines, current, width = [], "", 0.0
    for ch in value:
        f = f_ui if is_wide(ch) else f_mono
        advance = draw.textlength(ch, font=f)
        if width + advance > max_width and current:
            lines.append(current)
            current, width = ch, advance
        else:
            current += ch
            width += advance
    lines.append(current)
    return lines


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def spark(draw, cx, cy, r, fill):
    k = r * 0.26
    draw.polygon(
        [
            (cx, cy - r),
            (cx + k, cy - k),
            (cx + r, cy),
            (cx + k, cy + k),
            (cx, cy + r),
            (cx - k, cy + k),
            (cx - r, cy),
            (cx - k, cy - k),
        ],
        fill=fill,
    )


def check(draw, cx, cy, color, size=6.0):
    draw.line(
        [(cx - s(size), cy), (cx - s(size * 0.25), cy + s(size * 0.7))],
        fill=color,
        width=s(1.6),
    )
    draw.line(
        [(cx - s(size * 0.25), cy + s(size * 0.7)), (cx + s(size), cy - s(size * 0.7))],
        fill=color,
        width=s(1.6),
    )


def arrow_up(draw, cx, cy, color, size=6.0):
    draw.line([(cx, cy + s(size)), (cx, cy - s(size))], fill=color, width=s(1.6))
    draw.line(
        [(cx - s(size * 0.7), cy - s(size * 0.3)), (cx, cy - s(size))],
        fill=color,
        width=s(1.6),
    )
    draw.line(
        [(cx + s(size * 0.7), cy - s(size * 0.3)), (cx, cy - s(size))],
        fill=color,
        width=s(1.6),
    )


def surface(img, box, radius, fill=PANEL, outline=BORDER, blur=26):
    """Rounded surface with a soft shadow, composited in place."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [box[0], box[1] + s(8), box[2], box[3] + s(12)], radius=radius, fill=(0, 0, 0, 130)
    )
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    draw = ImageDraw.Draw(img)
    rounded(draw, list(box), radius, fill=fill, outline=outline, width=s(1))
    return draw


class Notes:
    """Right-hand callout column: numbered notes with elbow leaders.

    All coordinates are device pixels; call `place()` before sizing the canvas
    so the illustration can grow to fit the notes.
    """

    def __init__(self, edge_x, text_x, wrap_width):
        self.edge_x = edge_x
        self.text_x = text_x
        self.wrap_width = wrap_width
        self.items = []
        self.placed = []
        self.probe = ImageDraw.Draw(Image.new("RGBA", (4, 4)))

    def add(self, y_element, title, detail="", order=None, elbow=26):
        """Queue one note.

        `order` keeps a note at the end of the numbering while its leader still
        starts at `y_element` (the badge lands below the others, the elbow walks
        there); `elbow` shifts that note's vertical run so two leaders never
        share a trunk.
        """
        self.items.append((y_element, title, detail, order, elbow))

    def place(self, min_gap):
        def sort_key(item):
            y_element, _, _, order, _ = item
            return (1, order, y_element) if order is not None else (0, 0, y_element)

        self.placed = []
        last_y = None
        for index, (y_element, title, detail, _, elbow) in enumerate(sorted(self.items, key=sort_key), start=1):
            center = y_element if last_y is None else max(y_element, last_y + min_gap)
            lines = wrap_mixed(self.probe, detail, 11.5, self.wrap_width)
            last_y = center
            self.placed.append((index, y_element, center, title, lines, elbow))
        return last_y

    def bottom(self):
        if not self.placed:
            return 0
        index, _, center, _, lines, _ = self.placed[-1]
        return center + s(21) + s(17) * (len(lines) - 1)

    def draw(self, draw):
        for index, y_element, center, title, lines, elbow in self.placed:
            badge_r = s(11)
            bx = self.text_x - s(30)
            elbow_x = self.edge_x + s(elbow)
            # leader: out of the panel, then vertically to the note, then into the badge
            draw.line([(self.edge_x + s(6), y_element), (elbow_x, y_element)], fill=ANNO, width=s(1))
            draw.line([(elbow_x, y_element), (elbow_x, center)], fill=ANNO, width=s(1))
            x = elbow_x
            while x < bx - badge_r - s(4):
                draw.line([(x, center), (min(x + s(8), bx - badge_r - s(4)), center)], fill=ANNO, width=s(1))
                x += s(14)
            draw.ellipse([bx - badge_r, center - badge_r, bx + badge_r, center + badge_r], fill=ACCENT)
            text(draw, bx, center - s(1), str(index), font("bold", 12), (255, 255, 255), anchor="mm")
            ty = center - s(14)
            text(draw, self.text_x, ty, title, font("bold", 13), TEXT)
            yy = ty + s(21)
            for line in lines:
                mixed(draw, self.text_x, yy, line, 11.5, ANNO)
                yy += s(17)


# --------------------------------------------------------------------------
# shared panel pieces
# --------------------------------------------------------------------------


def panel_head(draw, x, y, w):
    text(draw, x, y, "提示词增强", font("bold", 13), TEXT)
    text(draw, x, y + s(19), "先选类型，再增强；结果会回填到输入框", font("ui", 11), TEXT3)
    bx = x + w - s(22)
    rounded(draw, [bx, y - s(2), bx + s(22), y + s(20)], s(6), fill=PANEL_HI)
    text(draw, bx + s(11), y + s(9), "×", font("ui", 13), TEXT3, anchor="mm")


TAB_LABELS = ("代码", "创作", "文档")


def panel_tabs(draw, x, y, w, labels=TAB_LABELS, active=0):
    rounded(draw, [x, y, x + w, y + s(32)], s(10), fill=(40, 42, 47))
    pad = s(3)
    seg = (w - pad * 2) / len(labels)
    for index, label in enumerate(labels):
        left = x + pad + seg * index
        if index == active:
            rounded(draw, [left, y + pad, left + seg, y + s(32) - pad], s(8), fill=(60, 64, 72))
        text(
            draw,
            left + seg / 2,
            y + s(16),
            label,
            font("bold" if index == active else "ui", 12),
            TEXT if index == active else TEXT2,
            anchor="mm",
        )


def panel_card(draw, x, y, w, title, hint, active):
    h = s(52)
    rounded(
        draw,
        [x, y, x + w, y + h],
        s(10),
        fill=(38, 41, 47) if active else None,
        outline=(103, 124, 186) if active else BORDER_SOFT,
        width=s(1),
    )
    cx, cy = x + s(16.5), y + s(14.5)
    if active:
        draw.ellipse([cx - s(6.5), cy - s(6.5), cx + s(6.5), cy + s(6.5)], outline=ACCENT, width=s(1.6))
        draw.ellipse([cx - s(2.6), cy - s(2.6), cx + s(2.6), cy + s(2.6)], fill=ACCENT)
    else:
        draw.ellipse([cx - s(6.5), cy - s(6.5), cx + s(6.5), cy + s(6.5)], outline=(108, 114, 124), width=s(1.4))
    text(draw, x + s(29), y + s(8), title, font("bold", 12.5), TEXT)
    text(draw, x + s(29), y + s(28), hint, font("ui", 11), TEXT3)
    return y + h


def panel_check(draw, x, y, label, active):
    f = font("ui", 12)
    tw = draw.textlength(label, font=f)
    w = tw + s(20) + (s(14) if active else 0)
    h = s(26)
    rounded(
        draw,
        [x, y, x + w, y + h],
        s(13),
        fill=ACCENT_DIM if active else None,
        outline=ACCENT if active else BORDER_SOFT,
        width=s(1),
    )
    if active:
        check(draw, x + s(14), y + h / 2, (168, 198, 255))
        text(draw, x + s(26), y + h / 2, label, f, (203, 219, 255), anchor="lm")
    else:
        text(draw, x + s(10), y + h / 2, label, f, TEXT2, anchor="lm")
    return x + w


DEPTHS = (("简洁", False), ("默认", True), ("严谨", False))
DEPTH_HINT = "分节但克制，约为严谨档的三分之二"


def panel_depth(draw, x, y, hint_x):
    """The 档位 row: small label, three length chips (默认 active), dimmed hint.

    Mirrors `client.js`: the depth chips reuse the focus row's `.dpe-check`
    styling, the hint is the active level's `hint` shown as a `.dpe-label`.
    """
    text(draw, x, y + s(6), "档位", font("ui", 11), TEXT3)
    cursor = x + s(56)
    for label, active in DEPTHS:
        cursor = panel_check(draw, cursor, y, label, active) + s(6)
    text(draw, hint_x, y + s(13), DEPTH_HINT, font("ui", 11), TEXT3, anchor="lm")
    return cursor


def panel_select(draw, x, y, w, label):
    h = s(26)
    rounded(draw, [x, y, x + w, y + h], s(8), fill=FIELD, outline=(103, 124, 186), width=s(1))
    text(draw, x + s(9), y + h / 2, label, font("ui", 12), TEXT, anchor="lm")
    ax = x + w - s(13)
    draw.polygon(
        [(ax - s(4), y + h / 2 - s(2)), (ax + s(4), y + h / 2 - s(2)), (ax, y + h / 2 + s(3))],
        fill=TEXT3,
    )


def button(draw, x, y, label, primary=False, height=28):
    f = font("bold" if primary else "ui", 12)
    w = draw.textlength(label, font=f) + s(24)
    h = s(height)
    if primary:
        fill, outline, color = ACCENT, None, (255, 255, 255)
    else:
        fill, outline, color = (44, 47, 53), BORDER_SOFT, TEXT2
    rounded(draw, [x, y, x + w, y + h], s(8), fill=fill, outline=outline, width=s(1) if outline else 0)
    text(draw, x + w / 2, y + h / 2, label, f, color, anchor="mm")
    return x + w + s(8)


# --------------------------------------------------------------------------
# illustration 1: the trigger inside the composer
# --------------------------------------------------------------------------


def render_composer(path):
    css_w = 1420
    edge_x = s(900)
    box = [s(56), s(40), edge_x, s(252)]
    x0, y0, x1, _ = box

    notes = Notes(edge_x, s(970), s(400))
    notes.add(y0 + s(76), "只写回输入框", "增强结果落到草稿里，不替你发送；写回前还可以继续编辑")
    notes.add(y0 + s(166), "常驻按钮", "输入框右侧控件行，hero（新建会话）与会话内两种输入形态都在")
    notes.place(s(64))

    height = max(box[3], notes.bottom()) + s(36)
    img = Image.new("RGBA", (s(css_w), height), BG + (255,))
    draw = surface(img, box, s(16))

    text(draw, x0 + s(22), y0 + s(18), "会话 · Report_Builder", font("ui", 11.5), TEXT3)
    draw.ellipse([x1 - s(30), y0 + s(20), x1 - s(24), y0 + s(26)], fill=(92, 98, 108))

    field = [x0 + s(18), y0 + s(42), x1 - s(18), y0 + s(152)]
    rounded(draw, field, s(12), fill=FIELD, outline=BORDER_SOFT, width=s(1))
    draft = ["把批量重命名图片的桌面小工具补全：", "要能预览、支持正则、失败了能回滚。"]
    for i, line in enumerate(draft):
        text(draw, field[0] + s(14), field[1] + s(16) + s(24) * i, line, font("ui", 13), TEXT)
    caret_x = field[0] + s(14) + draw.textlength(draft[1], font=font("ui", 13)) + s(2)
    draw.line(
        [(caret_x, field[1] + s(43)), (caret_x, field[1] + s(60))],
        fill=TEXT2,
        width=s(1.4),
    )

    row_y = field[3] + s(14)
    model_f = font("ui", 11.5)
    model = "deepseek-v4.1-flash"
    model_w = draw.textlength(model, font=model_f) + s(34)
    rounded(draw, [x0 + s(22), row_y, x0 + s(22) + model_w, row_y + s(28)], s(8), fill=PANEL_HI, outline=BORDER_SOFT, width=s(1))
    text(draw, x0 + s(34), row_y + s(14), model, model_f, TEXT2, anchor="lm")
    mx = x0 + s(22) + model_w - s(15)
    draw.polygon([(mx - s(4), row_y + s(12)), (mx + s(4), row_y + s(12)), (mx, row_y + s(17))], fill=TEXT3)

    send_cx, send_cy, send_r = x1 - s(38), row_y + s(14), s(15)
    draw.ellipse(
        [send_cx - send_r, send_cy - send_r, send_cx + send_r, send_cy + send_r],
        fill=(52, 56, 64),
        outline=BORDER_SOFT,
        width=s(1),
    )
    arrow_up(draw, send_cx, send_cy, TEXT2)

    label = "提示词增强"
    f = font("bold", 12)
    btn_w = draw.textlength(label, font=f) + s(46)
    btn_h = s(28)
    bx1 = send_cx - send_r - s(12)
    bx0 = bx1 - btn_w
    rounded(draw, [bx0, row_y, bx1, row_y + btn_h], s(14), fill=ACCENT_DIM, outline=ACCENT, width=s(1.4))
    spark(draw, bx0 + s(17), row_y + btn_h / 2, s(7), (150, 185, 255))
    text(draw, bx0 + s(32), row_y + btn_h / 2, label, f, (208, 222, 255), anchor="lm")

    notes.draw(draw)

    img.convert("RGB").save(path, optimize=True)
    return img.size


# --------------------------------------------------------------------------
# illustration 2: the idle panel
# --------------------------------------------------------------------------


def render_panel(path):
    css_w = 1500
    pad = s(20)
    panel = [s(52), s(36), s(1096), 0]  # bottom filled after layout
    inner_w = (panel[2] - pad) - (panel[0] + pad)
    edge_x = panel[2]

    y = s(56)
    y += s(34) + s(14)  # head
    tabs_y = y
    y += s(32) + s(12)
    cards_y = y
    y += s(52) + s(6) + s(52)
    y += s(12)
    focus_y = y
    y += s(32)
    depth_y = y
    y += s(32)
    method_y = y
    y += s(32) + s(10)
    note_y = y
    note_h = s(96)
    y += note_h + s(14)
    actions_y = y
    y += s(28) + s(8) + s(16)
    meta_y = actions_y + s(37)
    bottom = meta_y + s(18) + s(20)
    panel[3] = bottom

    notes = Notes(edge_x, s(1172), s(300))
    notes.add(tabs_y + s(16), "先选大类", "代码 / 创作 / 文档，切换会记住各自上次用的方式")
    notes.add(cards_y + s(83), "六种增强方式", "每类两种，卡片上写着各自的增益")
    notes.add(focus_y + s(13), "代码类再加方向", "完善开发框架 / 审查安全性，可多选、至少一项")
    notes.add(method_y + s(13), "方法论可自适应", "默认 auto 按场景打分，也可手动锁定某一家")
    notes.add(note_y + note_h / 2, "工作区证据可见", "读取前就告诉你要扫哪、多少文件、几处安全命中")
    notes.add(actions_y + s(14), "一句话启动", "不自动发送：结果只回填输入框")
    # Appended last in the numbering: the row is mid-panel, the badge sits at the
    # bottom of the column and its leader elbows down past the other annotations.
    notes.add(
        depth_y + s(13),
        "档位独立于类型",
        "同一个请求可以只留三行，也可以给到完整结构",
        order=1,
        elbow=12,
    )
    notes.place(s(60))

    img = Image.new("RGBA", (s(css_w), max(bottom, notes.bottom()) + s(34)), BG + (255,))
    draw = surface(img, panel, s(14))
    x0, y0 = panel[0], panel[1]
    inner_x = x0 + pad

    panel_head(draw, inner_x, y0 + s(20), inner_w)
    panel_tabs(draw, inner_x, tabs_y, inner_w)
    panel_card(
        draw,
        inner_x,
        cards_y,
        inner_w,
        "读取工作区后优化",
        "先扫描当前工作区的目录与关键文件，再按真实代码改写提示词",
        True,
    )
    panel_card(
        draw,
        inner_x,
        cards_y + s(58),
        inner_w,
        "仅按提示词优化",
        "不读取代码，按提示词判断开发类型并补全开发框架",
        False,
    )

    text(draw, inner_x, focus_y + s(6), "优化方向", font("ui", 11), TEXT3)
    cx = panel_check(draw, inner_x + s(56), focus_y, "完善开发框架", True) + s(6)
    panel_check(draw, cx, focus_y, "审查安全性", True)

    panel_depth(draw, inner_x, depth_y, inner_x + s(258))

    text(draw, inner_x, method_y + s(6), "方法论", font("ui", 11), TEXT3)
    panel_select(draw, inner_x + s(56), method_y, s(190), "自适应（推荐）")
    text(draw, inner_x + s(258), method_y + s(13), "→ Superpowers", font("ui", 11), (150, 176, 230), anchor="lm")

    rounded(draw, [inner_x, note_y, inner_x + inner_w, note_y + note_h], s(9), fill=(35, 38, 43), outline=BORDER_SOFT, width=s(1))
    nx, ny = inner_x + s(12), note_y + s(9)
    text(draw, nx, ny, "工作区", font("bold", 11), TEXT3)
    mixed(draw, nx + s(46), ny, r"K:\desktop\project\Report_Builder", 11, TEXT2)
    text(draw, nx, ny + s(21), "42 个文件 · 安全扫描命中 3 处", font("ui", 11), TEXT3)
    mixed(
        draw,
        nx,
        ny + s(42),
        "src/main.js · src/rename.js · package.json · README.md",
        10.5,
        (152, 158, 168),
    )
    rounded(
        draw,
        [inner_x + inner_w - s(62), ny - s(2), inner_x + inner_w - s(12), ny + s(22)],
        s(6),
        fill=PANEL_HI,
        outline=BORDER_SOFT,
        width=s(1),
    )
    text(draw, inner_x + inner_w - s(37), ny + s(10), "刷新", font("ui", 11), TEXT2, anchor="mm")

    x_cursor = button(draw, inner_x, actions_y, "开始增强", primary=True)
    text(draw, x_cursor + s(2), actions_y + s(14), "增强后会给出可直接使用的完整提示词。", font("ui", 11), TEXT3, anchor="lm")
    mixed(draw, inner_x, meta_y, "模型 workbuddy2api-hub/deepseek-v4.1-flash", 11, TEXT3)

    notes.draw(draw)

    img.convert("RGB").save(path, optimize=True)
    return img.size


# --------------------------------------------------------------------------
# illustration 3: the result state
# --------------------------------------------------------------------------

RESULT_TEXT = """# 目标
为「批量重命名图片」桌面小工具补齐完整实现，交付可运行、可验收的版本。

## 现状依据
- src/main.js:12-40 已有文件选择与缩略图预览；改名前要先 dry-run。
- package.json 只有 electron + sharp，没有测试框架。

## 实施步骤
1. 抽出规则层 src/rules.js：planRename(files, pattern) 返回 {from,to,conflict}[]。
2. 复用现有预览表渲染结果；应用前校验父目录与扩展名白名单。
3. 失败回滚：先写 .bak 清单再重命名，异常时按清单还原。

## 安全检查表
| 风险 | 现状 | 要求 |
| 路径穿越 | to 由 pattern 拼接，未校验 | 解析后必须仍在所选目录内 |
| 覆盖写 | 没有冲突检测 | 冲突项默认跳过并高亮 |
| 命令注入 | 没有 shell 调用 | 保持 spawn 数组参数 |

## 验收标准
- 200 张 4K 图片 dry-run < 1.5s，应用 < 3s；中断后可回滚。"""


def render_result(path):
    css_w = 1560
    pad = s(20)
    panel = [s(52), s(34), s(1150), 0]
    inner_w = (panel[2] - pad) - (panel[0] + pad)
    edge_x = panel[2]

    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    size = 10.5
    line_h = s(23)
    visual = []
    for raw in RESULT_TEXT.split("\n"):
        for piece in wrap_mixed(probe, raw, size, inner_w - s(26)):
            visual.append(piece)
    text_h = s(12) + line_h * len(visual) + s(10)

    y = s(54)
    y += s(34) + s(12)
    tabs_y = y
    y += s(32) + s(10)
    cards_y = y
    y += s(52) + s(12)
    label_y = y
    y += s(18)
    result_top = y
    y += text_h + s(10)
    actions_y = y
    y += s(28) + s(9) + s(16)
    meta_y = actions_y + s(37)
    bottom = meta_y + s(18) + s(20)
    panel[3] = bottom

    notes = Notes(edge_x, s(1224), s(310))
    notes.add(result_top + s(70), "结果可直接编辑", "增强结果是草稿不是终稿：先改再回填")
    notes.add(actions_y + s(14), "四种落盘方式", "替换输入框 / 插入到光标 / 复制 / 再试一次")
    notes.add(meta_y + s(6), "元信息可追溯", "这次用了哪家模型、哪套方法论、读了多少文件、命中几处")
    notes.place(s(64))

    img = Image.new("RGBA", (s(css_w), max(bottom, notes.bottom()) + s(32)), BG + (255,))
    draw = surface(img, panel, s(14))
    x0, y0 = panel[0], panel[1]
    inner_x = x0 + pad

    panel_head(draw, inner_x, y0 + s(18), inner_w)
    # `ui-result.png` is out of scope for the doc-family refresh: keep its tab row
    # exactly as shipped in the existing picture (two families, code active).
    panel_tabs(draw, inner_x, tabs_y, inner_w, labels=("代码", "创作"))
    panel_card(
        draw,
        inner_x,
        cards_y,
        inner_w,
        "读取工作区后优化",
        "先扫描当前工作区的目录与关键文件，再按真实代码改写提示词",
        True,
    )

    text(draw, inner_x, label_y, "增强结果", font("ui", 11), TEXT3)
    rounded(draw, [inner_x, result_top, inner_x + inner_w, result_top + text_h], s(10), fill=FIELD, outline=(100, 120, 180), width=s(1))
    for i, line in enumerate(visual):
        color = TEXT if line.startswith("#") else (196, 202, 211)
        mixed(draw, inner_x + s(13), result_top + s(12) + line_h * i, line, size, color)

    x_cursor = button(draw, inner_x, actions_y, "替换输入框", primary=True)
    x_cursor = button(draw, x_cursor, actions_y, "插入到光标")
    x_cursor = button(draw, x_cursor, actions_y, "复制")
    x_cursor = button(draw, x_cursor, actions_y, "再试一次")
    back_label = "返回修改"
    back_w = draw.textlength(back_label, font=font("ui", 12)) + s(24)
    button(draw, inner_x + inner_w - back_w, actions_y, back_label)

    meta_y = actions_y + s(37)
    mixed(draw, inner_x, meta_y, "模型 workbuddy2api-hub/deepseek-v4.1-flash", 11, TEXT3)
    mixed(draw, inner_x + s(286), meta_y, "方法论 Superpowers", 11, TEXT3)
    mixed(draw, inner_x + s(410), meta_y, "读取文件 10", 11, TEXT3)
    mixed(draw, inner_x + s(500), meta_y, "安全命中 3", 11, WARN)

    notes.draw(draw)

    img.convert("RGB").save(path, optimize=True)
    return img.size


# --------------------------------------------------------------------------
# illustration 4: the document family panel (doc-fill selected)
# --------------------------------------------------------------------------


def panel_doc_block(draw, x, y, w, h):
    """The document row: selected file, size/headings, outline, picker, refresh."""
    rounded(draw, [x, y, x + w, y + h], s(9), fill=(35, 38, 43), outline=BORDER_SOFT, width=s(1))
    nx, ny = x + s(12), y + s(18)
    text(draw, nx, ny, "文档", font("bold", 11), TEXT3)
    label_w = draw.textlength("文档", font=font("bold", 11))
    mixed(draw, nx + label_w + s(8), ny, "prompt-enhance/README.md", 11, TEXT2)
    text(draw, nx, ny + s(34), "11340 字 · 27 个标题", font("ui", 11), TEXT3)
    mixed(draw, nx, ny + s(78), "目录 · 功能 · 界面一览 · 六种增强方式", 10.5, (152, 158, 168))
    panel_select(draw, nx, ny + s(118), w - s(24), "自动挑选（相关性优先）")
    button(draw, nx, ny + s(162), "刷新文档", height=24)


def render_panel_doc(path):
    css_w = 1500
    pad = s(20)
    panel = [s(52), s(36), s(1096), 0]
    inner_w = (panel[2] - pad) - (panel[0] + pad)
    edge_x = panel[2]

    y = s(56)
    y += s(34) + s(14)  # head
    tabs_y = y
    y += s(32) + s(12)
    cards_y = y
    y += s(52) + s(6) + s(52)
    y += s(14)
    doc_y = y
    doc_h = s(216)
    y += doc_h + s(12)
    depth_y = y
    y += s(32)
    method_y = y
    y += s(32) + s(12)
    actions_y = y
    bottom = actions_y + s(28) + s(16)
    panel[3] = bottom

    notes = Notes(edge_x, s(1172), s(300))
    notes.add(doc_y + s(38), "选中文档与其字数、标题数")
    notes.add(doc_y + s(100), "文档框架大纲的前几条，用于对齐结构")
    notes.add(doc_y + s(149), "候选文档下拉：可手动指定要补写的文件")
    notes.add(doc_y + s(195), "刷新文档会重新扫描工作区")
    notes.add(doc_y + s(208), "自动挑选按提示词相关性与近期修改排序")
    notes.add(
        depth_y + s(13),
        "档位独立于类型",
        "同一个请求可以只留三行，也可以给到完整结构",
        order=1,
        elbow=12,
    )
    notes.place(s(46))

    img = Image.new("RGBA", (s(css_w), max(bottom, notes.bottom()) + s(34)), BG + (255,))
    draw = surface(img, panel, s(14))
    x0, y0 = panel[0], panel[1]
    inner_x = x0 + pad

    panel_head(draw, inner_x, y0 + s(20), inner_w)
    panel_tabs(draw, inner_x, tabs_y, inner_w, active=2)
    panel_card(
        draw,
        inner_x,
        cards_y,
        inner_w,
        "读文档后补写",
        "先读当前文档的框架与格式，再按既有结构补写缺失内容",
        True,
    )
    panel_card(
        draw,
        inner_x,
        cards_y + s(58),
        inner_w,
        "按类型起草",
        "没有现成文档时，按文档类型搭好框架与写作要求",
        False,
    )
    panel_doc_block(draw, inner_x, doc_y, inner_w, doc_h)

    panel_depth(draw, inner_x, depth_y, inner_x + s(258))

    text(draw, inner_x, method_y + s(6), "方法论", font("ui", 11), TEXT3)
    panel_select(draw, inner_x + s(56), method_y, s(190), "自适应（推荐）")
    text(
        draw,
        inner_x + s(258),
        method_y + s(13),
        "→ LangGPT 结构化提示词",
        font("ui", 11),
        (150, 176, 230),
        anchor="lm",
    )

    x_cursor = button(draw, inner_x, actions_y, "开始增强", primary=True)
    text(
        draw,
        x_cursor + s(2),
        actions_y + s(14),
        "增强后会给出可直接使用的完整提示词。",
        font("ui", 11),
        TEXT3,
        anchor="lm",
    )

    notes.draw(draw)

    img.convert("RGB").save(path, optimize=True)
    return img.size


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    for name, render in (
        ("ui-composer.png", render_composer),
        ("ui-panel.png", render_panel),
        ("ui-panel-doc.png", render_panel_doc),
        ("ui-result.png", render_result),
    ):
        target = os.path.join(here, name)
        width, height = render(target)
        print(f"{name}: {width}x{height} ({os.path.getsize(target)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
