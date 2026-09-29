from pathlib import Path

from PIL import Image, ImageDraw


def render_scale_photo(path: str | Path, width: int = 800, height: int = 500) -> None:
    """Снимок с контрастной масштабной линейкой и условным предметом."""
    image = Image.new("RGB", (width, height), (236, 230, 218))
    draw = ImageDraw.Draw(image)
    x = 100
    black = True
    while x < 500:
        x2 = min(x + 25, 500)
        draw.rectangle([x, 60, x2, 96], fill=(20, 20, 20) if black else (248, 248, 248))
        black = not black
        x = x2
    draw.rectangle([160, 180, 460, 300], fill=(122, 74, 48))
    draw.rectangle([158, 178, 462, 302], outline=(60, 36, 22))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
