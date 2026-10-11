"""Изолированный модуль фотоанализа.

API и учётные сервисы обращаются к нему только через функции этого модуля.
Здесь нет работы с пользователями, ролями и карточками находок.
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger("archaeology.photo")

STATUS_DETECTED = "detected"
STATUS_MANUAL = "manual_correction_required"
STATUS_NOT_FOUND = "marker_not_found"

_MESSAGES = {
    STATUS_DETECTED: "Масштабный маркер найден автоматически. Проверьте положение линии перед принятием результата.",
    STATUS_MANUAL: "Маркер распознан неуверенно. Поправьте контрольные точки вручную.",
    STATUS_NOT_FOUND: "Масштабный маркер не найден. Укажите контрольные точки вручную.",
}


def detect_scale_marker(path: str) -> dict:
    try:
        data = np.fromfile(path, dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    except OSError:
        image = None
    if image is None:
        logger.warning("photo analysis could not read %s", path)
        return _result(STATUS_NOT_FOUND, [], 0)
    return detect_in_image(image)


def detect_in_image(image: np.ndarray) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    horizontal = _scan_lines(gray, horizontal=True)
    vertical = _scan_lines(gray, horizontal=False)
    best = horizontal
    if vertical and (best is None or vertical["score"] > best["score"]):
        best = vertical
    if best is None:
        return _result(STATUS_NOT_FOUND, [], 0)
    points = [
        {"x": float(best["x1"]), "y": float(best["y1"])},
        {"x": float(best["x2"]), "y": float(best["y2"])},
    ]
    if best.get("ambiguous"):
        status = STATUS_MANUAL
    elif best["changes"] >= 4:
        status = STATUS_DETECTED
    elif best["changes"] >= 2:
        status = STATUS_MANUAL
    else:
        status = STATUS_NOT_FOUND
        points = []
    confidence = min(1.0, best["changes"] / 8)
    logger.info(
        "marker status=%s changes=%s span=%s",
        status,
        best["changes"],
        best["span"],
    )
    return _result(status, points, round(confidence, 3))


def analyze_photo_file(path: str, scale_mm: float | None = None) -> dict:
    try:
        data = np.fromfile(path, dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    except OSError:
        image = None
    if image is None:
        logger.warning("photo analysis could not read %s", path)
        empty = analyze_image(np.zeros((8, 8, 3), dtype=np.uint8), scale_mm)
        empty["status"] = STATUS_NOT_FOUND
        empty["message"] = _MESSAGES[STATUS_NOT_FOUND]
        empty["scale_points"] = []
        empty["object_status"] = "not_found"
        empty["length_points"] = []
        empty["width_points"] = []
        empty["length_mm"] = None
        empty["width_mm"] = None
        return empty
    return analyze_image(image, scale_mm)


def analyze_image(image: np.ndarray, scale_mm: float | None = None) -> dict:
    """Маркер и контур предмета. Миллиметры считаются, если известна длина маркера."""
    marker = detect_in_image(image)
    length_points, width_points = _object_axes(image, marker["points"])
    object_status = "detected" if length_points and width_points else "not_found"
    scale_px = None
    mm_per_pixel = None
    length_mm = None
    width_mm = None
    length_px = None
    width_px = None
    if len(marker["points"]) == 2:
        scale_px = _segment(marker["points"][0], marker["points"][1])
    if length_points:
        length_px = _segment(length_points[0], length_points[1])
        width_px = _segment(width_points[0], width_points[1])
    if (
        scale_mm
        and scale_mm > 0
        and scale_px
        and marker["status"] == STATUS_DETECTED
        and length_px
        and width_px
    ):
        from app.utils.measurement import calculate_measurement

        mm_per_pixel = scale_mm / scale_px
        length_mm = calculate_measurement(marker["points"], length_points, scale_mm)["result_mm"]
        width_mm = calculate_measurement(marker["points"], width_points, scale_mm)["result_mm"]
    return {
        "status": marker["status"],
        "confidence": marker["confidence"],
        "source": marker["source"],
        "message": _analysis_message(marker["status"], object_status),
        "scale_points": marker["points"],
        "scale_pixel_distance": None if scale_px is None else round(scale_px, 4),
        "object_status": object_status,
        "length_points": length_points,
        "width_points": width_points,
        "length_px": None if length_px is None else round(length_px, 4),
        "width_px": None if width_px is None else round(width_px, 4),
        "scale_mm": scale_mm,
        "mm_per_pixel": None if mm_per_pixel is None else round(mm_per_pixel, 6),
        "length_mm": length_mm,
        "width_mm": width_mm,
    }


def _analysis_message(marker_status: str, object_status: str) -> str:
    if marker_status == STATUS_DETECTED and object_status == "detected":
        return (
            "Маркер и контур предмета найдены автоматически. "
            "Проверьте жёлтую, красную и синюю линии. Толщину укажите вручную, если виден боковой край. "
            "Размер записывается в карточку только после «Принять»."
        )
    if marker_status == STATUS_DETECTED:
        return "Масштабный маркер найден. Контур предмета не выделен: укажите длину и ширину точками на снимке."
    if marker_status == STATUS_MANUAL and object_status == "detected":
        return "Контур предмета найден, маркер распознан неуверенно. Поправьте жёлтую линию и проверьте размер."
    return _MESSAGES[marker_status]


def _object_axes(image: np.ndarray, marker_points: list[dict]) -> tuple[list[dict], list[dict]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    if len(marker_points) == 2:
        start = (int(round(marker_points[0]["x"])), int(round(marker_points[0]["y"])))
        end = (int(round(marker_points[1]["x"])), int(round(marker_points[1]["y"])))
        cv2.line(binary, start, end, 0, thickness=48)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    contours, _hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    min_area = 0.01 * height * width
    best = None
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area:
            continue
        if best is None or area > best[0]:
            best = (area, contour)
    if best is None:
        return [], []
    box = cv2.boxPoints(cv2.minAreaRect(best[1]))
    return _axis_lines(box)


def _axis_lines(box: np.ndarray) -> tuple[list[dict], list[dict]]:
    points = [(float(point[0]), float(point[1])) for point in box]
    edges = []
    for index, start in enumerate(points):
        end = points[(index + 1) % 4]
        edges.append((_segment({"x": start[0], "y": start[1]}, {"x": end[0], "y": end[1]}), start, end))
    edges.sort(key=lambda item: item[0])

    def midpoint(edge) -> dict:
        return {"x": round((edge[1][0] + edge[2][0]) / 2, 2), "y": round((edge[1][1] + edge[2][1]) / 2, 2)}

    length = [midpoint(edges[0]), midpoint(edges[1])]
    width = [midpoint(edges[2]), midpoint(edges[3])]
    if _segment(length[0], length[1]) < _segment(width[0], width[1]):
        length, width = width, length
    return length, width


def _segment(first: dict, second: dict) -> float:
    return float(np.hypot(first["x"] - second["x"], first["y"] - second["y"]))


def _result(status: str, points: list[dict], confidence: float) -> dict:
    return {
        "status": status,
        "points": points,
        "scale_points": points,
        "confidence": confidence,
        "message": _MESSAGES[status],
        "source": "opencv" if status != STATUS_NOT_FOUND else "none",
    }


def _scan_lines(gray: np.ndarray, horizontal: bool) -> dict | None:
    height, width = gray.shape[:2]
    limit = width if horizontal else height
    other = height if horizontal else width
    min_span = max(30, int(limit * 0.05))
    best = None
    for index in range(0, other, 2):
        line = gray[index, :] if horizontal else gray[:, index]
        binary = line < 140
        changes_idx = np.flatnonzero(binary[1:] != binary[:-1])
        if len(changes_idx) < 2:
            continue
        start = int(changes_idx[0]) + 1
        end = int(changes_idx[-1])
        ambiguous = False
        # Thresholding sees only dark segments. Include a visible light end segment,
        # otherwise the known length is divided by a truncated ruler (e.g. 375 vs 400 px).
        intervals = np.diff(changes_idx)
        if len(intervals) >= 5:
            pitch = float(np.median(intervals))
            regular = np.mean(np.abs(intervals - pitch) <= max(2, pitch * 0.2)) >= 0.8
            bright_samples = [float(np.median(line[int(left)+1:int(right)+1]))
                              for left, right in zip(changes_idx[:-1], changes_idx[1:])
                              if not binary[int((left + right) // 2) + 1]]
            if regular and bright_samples:
                bright = float(np.median(bright_samples))
                left, left_ambiguous = _bright_end(line, start - 1, -1, pitch, bright)
                right, right_ambiguous = _bright_end(line, end + 1, 1, pitch, bright)
                if left is not None:
                    start = left
                if right is not None:
                    end = right
                ambiguous = left_ambiguous or right_ambiguous
        span = end - start
        if span < min_span:
            continue
        score = int(len(changes_idx)) * span
        if best is None or score > best["score"]:
            if horizontal:
                x1, y1, x2, y2 = start, index, end, index
            else:
                x1, y1, x2, y2 = index, start, index, end
            best = {
                "score": score,
                "ambiguous": ambiguous,
                "changes": int(len(changes_idx)),
                "span": span,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
            }
    return best


def _bright_end(line: np.ndarray, first: int, direction: int, pitch: float, bright: float):
    """Locate a light end stripe only when its outer edge is visible.

    If its tone merges with the background, don't claim an automatic calibration.
    """
    tolerance = 5
    if first < 0 or first >= len(line) or abs(float(line[first]) - bright) > tolerance:
        return None, False
    samples = max(3, int(round(pitch * 1.6)))
    run = 0
    for offset in range(samples):
        index = first + direction * offset
        if not 0 <= index < len(line):
            return None, True
        if abs(float(line[index]) - bright) > tolerance:
            # Demand a stable boundary rather than one noisy pixel.
            following = [index + direction * step for step in range(3)]
            if all(0 <= i < len(line) and abs(float(line[i]) - bright) > tolerance for i in following):
                if 0.65 * pitch <= run <= 1.35 * pitch:
                    return index - direction, False
                return None, True
        run += 1
    return None, True
