#!/usr/bin/env python3
"""Render `depth.svg`: the three length bands as a yardstick.

Pure vector like `generate-diagrams.py` (no fonts embedded, standard library
only), so it inherits the reader's UI font. The numbers come straight from
`strategies.js`: Superpowers' thorough band (4200 chars) is the yardstick, the
other methodologies are scaled by their measured length ratio, and each band
multiplies that by the depth coefficient (0.34 / 0.64 / 1).

Usage: python docs/images/generate-depth.py
"""

import os
import sys
from xml.sax.saxutils import escape

UI = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',system-ui,sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

BG = "#111214"
CARD = "#1b1d21"
CARD_HI = "#23262b"
STROKE = "#3a3e46"
STROKE_SOFT = "#2b2f36"
TEXT = "#eceef1"
TEXT2 = "#aeb4bd"
TEXT3 = "#7f8690"
ACCENT = "#5884ff"
BAR = "#3d5a9e"
WARN = "#e9aa5e"
TRACK = "#16181c"

STYLE = f"""
  text {{ font-family: {UI}; }}
  .mono {{ font-family: {MONO}; }}
  .title {{ fill: {TEXT}; font-size: 21px; font-weight: 600; }}
  .sub {{ fill: {TEXT3}; font-size: 13px; }}
  .label {{ fill: {TEXT3}; font-size: 11.5px; letter-spacing: .04em; }}
  .h {{ fill: {TEXT}; font-size: 15px; font-weight: 600; }}
  .b {{ fill: {TEXT2}; font-size: 12.5px; }}
  .b2 {{ fill: {TEXT3}; font-size: 12px; }}
  .n {{ fill: #ffffff; font-size: 12px; font-weight: 600; }}
  .card {{ fill: {CARD}; stroke: {STROKE}; }}
  .soft {{ fill: {CARD_HI}; stroke: {STROKE_SOFT}; }}
"""

# --------------------------------------------------------------------------
# numbers (mirrors strategies.js: METHODOLOGY_LENGTH x DEPTH_SCALE x 4200)
# --------------------------------------------------------------------------

YARDSTICK = 4200  # Superpowers, thorough band
NAMES = ["Superpowers", "Prompt Optimizer", "LangGPT", "AiShort"]
RATIOS = [("Prompt Optimizer", "0.72"), ("LangGPT", "0.74"), ("AiShort", "0.55")]
BANDS = [
    ("简洁", "≈ 严谨档的 1/3", "0.34", [1428, 1028, 1057, 785]),
    ("默认", "≈ 严谨档的 2/3", "0.64", [2688, 1935, 1989, 1478]),
    ("严谨", "标尺本身，× 1", "1", [4200, 3024, 3108, 2310]),
]

RAIL_X = 200  # left edge of every bar
RAIL_LEN = 560  # the length that stands for 4200 chars
VALUE_X = 816  # right edge of the value column


def svg(width, height, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img">\n'
        f"<style>{STYLE}</style>\n"
        f'<rect width="{width}" height="{height}" rx="16" fill="{BG}"/>\n'
        + "\n".join(body)
        + "\n</svg>\n"
    )


def rect(x, y, w, h, r=12, cls="card", fill=None, stroke=None, sw=1, extra=""):
    attrs = [f'x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"']
    if cls:
        attrs.append(f'class="{cls}"')
    if fill:
        attrs.append(f'fill="{fill}"')
    if stroke:
        attrs.append(f'stroke="{stroke}" stroke-width="{sw}"')
    if extra:
        attrs.append(extra)
    return f"<rect {' '.join(attrs)}/>"


def line(x1, y1, x2, y2, stroke=STROKE, sw=1.5, extra=""):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'


def text(x, y, value, cls="b", anchor="start", fill=None):
    paint = f' fill="{fill}"' if fill else ""
    return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}"{paint}>{escape(value)}</text>'


def bar_length(chars):
    return round(chars / YARDSTICK * RAIL_LEN, 1)


# --------------------------------------------------------------------------
# the band: band name + scale note + four proportional bars
# --------------------------------------------------------------------------


def band(x, y, w, h, index, name, note, coefficient, values):
    yardstick = index == 2
    body = [
        rect(
            x,
            y,
            w,
            h,
            14,
            "card",
            stroke="#4c5d86" if yardstick else None,
            sw=1.6 if yardstick else 1,
        ),
        text(x + 16, y + 24, name, "h"),
        text(x + 76, y + 24, note, "b2"),
        text(VALUE_X, y + 24, f"{YARDSTICK} × {coefficient} ≈ {values[0]}", "mono b2", "end"),
    ]
    for row, (method, chars) in enumerate(zip(NAMES, values)):
        cy = y + 43 + row * 17
        color = ACCENT if row == 0 else BAR
        body.append(text(x + 16, cy + 4, method, "b2"))
        body.append(rect(RAIL_X, cy - 4.5, RAIL_LEN, 9, 4.5, None, fill=TRACK, stroke=STROKE_SOFT, sw=1))
        body.append(rect(RAIL_X, cy - 4.5, bar_length(chars), 9, 4.5, None, fill=color))
        body.append(text(VALUE_X, cy + 4, str(chars), "mono b" if row == 0 else "mono b2", "end"))
    return body


# --------------------------------------------------------------------------
# the right column: why 4200 is the yardstick, and how the ratios apply
# --------------------------------------------------------------------------


def callout(x, y, w, h):
    inner = x + 20
    right = x + w - 20
    body = [
        rect(x, y, w, h, 14),
        text(inner, y + 30, "4200 字是标尺", "h"),
        text(inner, y + 56, "Superpowers 严谨档的实测成稿长度，", "b"),
        text(inner, y + 76, "同一个中等复杂度请求、中文字符。", "b"),
        text(inner, y + 102, "其余三家按实测长度比例缩放，", "b"),
        text(inner, y + 122, "同一档位下四家的含义才一致。", "b"),
        line(inner, y + 140, right, y + 140, STROKE_SOFT, 1),
        text(inner, y + 162, "实测长度比例（Superpowers = 1）", "label"),
    ]
    for row, (method, ratio) in enumerate(RATIOS):
        ry = y + 188 + row * 24
        body.append(text(inner, ry, method, "b"))
        body.append(text(right, ry, ratio, "mono b2", "end"))
    body.append(line(inner, y + 260, right, y + 260, STROKE_SOFT, 1))
    body.append(text(inner, y + 282, "4200 × 0.72 × 0.64 ≈ 1935", "mono b"))
    body.append(text(inner, y + 302, "即默认档的 Prompt Optimizer", "b2"))
    return body


def depth():
    width, height = 1240, 470
    body = [
        text(44, 52, "三档篇幅：Superpowers 严谨档是标尺", "title"),
        text(44, 78, "同一个请求只差长度：简洁约严谨档的三分之一，默认约三分之二；数字都是中文字符预算", "sub"),
    ]
    top, gap, band_h = 106, 7, 104
    for index, (name, note, coefficient, values) in enumerate(BANDS):
        body.extend(band(44, top + index * (band_h + gap), 816, band_h, index, name, note, coefficient, values))
    body.extend(callout(884, top, 312, band_h * 3 + gap * 2))
    body.append(
        text(
            44,
            458,
            "每行三段的横轴等长 = 同一把 4200 字标尺；条长即预算，右侧数字可直接引用。四家行序固定，便于逐档横读。",
            "label",
        )
    )
    return width, height, body


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    width, height, body = depth()
    target = os.path.join(here, "depth.svg")
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(svg(width, height, body))
    print(f"depth.svg: {width}x{height} ({os.path.getsize(target)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
