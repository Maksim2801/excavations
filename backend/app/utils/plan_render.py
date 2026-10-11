"""Server-side plan rasterizer for illustration albums (mirrors frontend canvas)."""
from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont


def _hex_color(value: str | None, fallback: str = "#8a8175") -> tuple[int, int, int]:
    text = (value or fallback).lstrip("#")
    if len(text) != 6:
        text = fallback.lstrip("#")
    return int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)


def render_plan_png(plan: dict, width: int = 1200, height: int = 900) -> bytes:
    image = Image.new("RGB", (width, height), "#f7f4ee")
    draw = ImageDraw.Draw(image)
    bounds = plan.get("bounds") or {}
    min_x = float(bounds.get("min_x", 0))
    max_x = float(bounds.get("max_x", 1))
    min_y = float(bounds.get("min_y", 0))
    max_y = float(bounds.get("max_y", 1))
    span_x = max_x - min_x or 1.0
    span_y = max_y - min_y or 1.0
    scale = min(width / span_x, height / span_y) * 0.86
    ox = (width - span_x * scale) / 2
    oy = (height - span_y * scale) / 2

    def px(x: float) -> float:
        return ox + (x - min_x) * scale

    def py(y: float) -> float:
        return height - (oy + (y - min_y) * scale)

    outline = plan.get("outline") or []
    if len(outline) >= 3:
        polygon = [(px(point["x"]), py(point["y"])) for point in outline]
        draw.polygon(polygon, fill="#e8decd", outline="#8A8A8A")

    for point in plan.get("gnss_points") or []:
        color = "#B5532B" if point.get("point_type") == "corner" else "#7A7A7A"
        x, y = px(point["x"]), py(point["y"])
        draw.rectangle((x - 4, y - 4, x + 4, y + 4), fill=color)

    for point in plan.get("points") or []:
        x, y = px(point["x"]), py(point["y"])
        r = 5
        draw.ellipse((x - r, y - r, x + r, y + r), fill=_hex_color(point.get("color")))

    legend = plan.get("legend") or []
    if legend:
        try:
            font = ImageFont.load_default()
        except OSError:
            font = None
        top = 12
        draw.rectangle((12, 12, 220, 12 + 18 * min(len(legend), 12) + 8), fill="#fffdf8", outline="#cfc3b0")
        for index, item in enumerate(legend[:12]):
            y = top + 8 + index * 18
            draw.rectangle((20, y, 32, y + 12), fill=_hex_color(item.get("color")))
            draw.text((38, y), str(item.get("key") or ""), fill="#2c2416", font=font)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
