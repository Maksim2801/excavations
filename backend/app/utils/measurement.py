import json
import math


def distance(p1: dict, p2: dict) -> float:
    return math.sqrt((float(p1["x"]) - float(p2["x"])) ** 2 + (float(p1["y"]) - float(p2["y"])) ** 2)


def _point(value) -> dict:
    if isinstance(value, dict):
        x = value.get("x")
        y = value.get("y")
    else:
        raise ValueError("Точка должна содержать координаты x и y")
    if x is None or y is None:
        raise ValueError("Точка должна содержать координаты x и y")
    x = float(x)
    y = float(y)
    if not math.isfinite(x) or not math.isfinite(y):
        raise ValueError("Координаты точки должны быть конечными числами")
    return {"x": x, "y": y}


def calculate_measurement(scale_points, object_points, scale_mm: float) -> dict:
    """Пересчёт размера объекта через масштабный отрезок.

    mm_per_pixel = scale_length_mm / scale_length_pixels
    object_length_mm = object_length_pixels * mm_per_pixel
    """
    if len(scale_points) != 2 or len(object_points) != 2:
        raise ValueError("Нужно 2 точки масштаба и 2 точки объекта")
    scale_mm = float(scale_mm)
    if not math.isfinite(scale_mm) or scale_mm <= 0:
        raise ValueError("Масштаб должен быть положительным")

    scale = [_point(scale_points[0]), _point(scale_points[1])]
    obj = [_point(object_points[0]), _point(object_points[1])]
    scale_px = distance(scale[0], scale[1])
    object_px = distance(obj[0], obj[1])
    if scale_px <= 0:
        raise ValueError("Неверное расстояние масштаба")
    if object_px <= 0:
        raise ValueError("Неверное расстояние измеряемого участка")

    mm_per_pixel = scale_mm / scale_px
    result_mm = object_px * mm_per_pixel
    return {
        "scale_pixel_distance": round(scale_px, 4),
        "object_pixel_distance": round(object_px, 4),
        "result_mm": round(result_mm, 4),
        "mm_per_pixel": round(mm_per_pixel, 6),
        "points_json": json.dumps(
            {"scale_points": scale, "object_points": obj},
            ensure_ascii=False,
        ),
    }
