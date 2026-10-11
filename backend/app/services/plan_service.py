import json
import math

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.constants import GNSS_TYPE_LABELS, LAYER_PALETTE, METHOD_LABELS
from app.models import GNSSPoint, Material, PlanColorScheme
from app.services.domain import get_excavation, get_layer


def _xy(view: str, north: float, east: float, elev: float) -> tuple[float, float]:
    if view == "n_elev":
        return north, elev
    if view == "e_elev":
        return east, elev
    return east, north


def build_plan(db: Session, excavation_id: int, layer_id: int | None, view: str, color_by: str | None) -> dict:
    if view not in {"ne", "n_elev", "e_elev"}:
        view = "ne"
    excavation = get_excavation(db, excavation_id)
    if layer_id:
        layer = get_layer(db, layer_id)
        if layer.excavation_id != excavation.id:
            from app.errors import AppError

            raise AppError(400, "Пласт принадлежит другому раскопу")
    scheme = (
        db.query(PlanColorScheme)
        .filter(PlanColorScheme.is_active.is_(True), PlanColorScheme.is_default.is_(True))
        .first()
    )
    mode = color_by or (scheme.mode if scheme else "material")
    if mode not in {"material", "layer"}:
        mode = "material"
    materials = {item.name: item.color for item in db.query(Material).all()}
    palette = list(LAYER_PALETTE)
    if scheme and scheme.mode == "layer":
        try:
            parsed = json.loads(scheme.mapping_json or "{}")
            if isinstance(parsed.get("palette"), list) and parsed["palette"]:
                palette = parsed["palette"]
        except json.JSONDecodeError:
            pass
    if scheme and scheme.mode == "material":
        try:
            parsed = json.loads(scheme.mapping_json or "{}")
            colors = parsed.get("colors")
            if isinstance(colors, dict):
                materials.update(colors)
        except json.JSONDecodeError:
            pass

    params = {"eid": excavation.id}
    layer_sql = ""
    if layer_id:
        layer_sql = "AND f.layer_id = :layer_id"
        params["layer_id"] = layer_id
    finding_rows = db.execute(
        text(
            f"""
            SELECT f.id, f.code, f.number, f.material, f.square, f.find_type,
                   f.length_mm, f.width_mm, f.thickness_mm, f.layer_id,
                   f.measurement_method, f.photo_present, f.description,
                   ST_X(f.geom) AS east, ST_Y(f.geom) AS north, ST_Z(f.geom) AS elev,
                   ST_AsText(f.geom) AS wkt,
                   l.number AS layer_number, l.color AS layer_color
            FROM findings f
            LEFT JOIN layers l ON l.id = f.layer_id
            WHERE f.excavation_id = :eid
              AND f.geom IS NOT NULL
              {layer_sql}
            ORDER BY f.number, f.id
            """
        ),
        params,
    ).mappings().all()

    gnss_rows = db.execute(
        text(
            """
            SELECT id, point_type, comment,
                   ST_X(geom) AS east, ST_Y(geom) AS north, ST_Z(geom) AS elev,
                   ST_AsText(geom) AS wkt
            FROM gnss_points
            WHERE excavation_id = :eid AND geom IS NOT NULL
            ORDER BY id
            """
        ),
        {"eid": excavation.id},
    ).mappings().all()

    points = []
    legend_keys: dict[str, str] = {}
    for row in finding_rows:
        layer_number = row["layer_number"]
        if mode == "layer":
            key = f"Пласт {layer_number}" if layer_number is not None else "Без пласта"
            color = row["layer_color"] or (palette[(int(layer_number) - 1) % len(palette)] if layer_number else "#8a8175")
        else:
            key = row["material"] or "без материала"
            color = materials.get(row["material"], "#8a8175")
        legend_keys[key] = color
        x, y = _xy(view, row["north"], row["east"], row["elev"])
        points.append(
            {
                "id": row["id"],
                "code": row["code"],
                "number": row["number"],
                "layer_id": row["layer_id"],
                "layer_number": layer_number,
                "material": row["material"],
                "square": row["square"],
                "find_type": row["find_type"],
                "north": row["north"],
                "east": row["east"],
                "elev": row["elev"],
                "length_mm": row["length_mm"],
                "width_mm": row["width_mm"],
                "thickness_mm": row["thickness_mm"],
                "measurement_method": row["measurement_method"],
                "measurement_method_label": METHOD_LABELS.get(row["measurement_method"], row["measurement_method"]),
                "photo_present": row["photo_present"],
                "description": row["description"],
                "x": x,
                "y": y,
                "color": color,
                "legend": key,
                "wkt": row["wkt"],
            }
        )

    gnss = []
    corners = []
    for row in gnss_rows:
        x, y = _xy(view, row["north"], row["east"], row["elev"])
        item = {
            "id": row["id"],
            "point_type": row["point_type"],
            "point_type_label": GNSS_TYPE_LABELS.get(row["point_type"], row["point_type"]),
            "comment": row["comment"],
            "north": row["north"],
            "east": row["east"],
            "elev": row["elev"],
            "x": x,
            "y": y,
            "wkt": row["wkt"],
        }
        gnss.append(item)
        if row["point_type"] == "corner":
            corners.append(item)

    outline = _outline(corners)
    xs = [point["x"] for point in points] + [point["x"] for point in gnss]
    ys = [point["y"] for point in points] + [point["y"] for point in gnss]
    center_x, center_y = _xy(view, excavation.center_north, excavation.center_east, excavation.center_elev)
    xs.append(center_x)
    ys.append(center_y)
    if not xs:
        xs = [center_x]
        ys = [center_y]
    pad_x = max((max(xs) - min(xs)) * 0.08, 1)
    pad_y = max((max(ys) - min(ys)) * 0.08, 0.2)
    return {
        "excavation_id": excavation.id,
        "excavation_code": excavation.code,
        "year": excavation.year,
        "view": view,
        "color_by": mode,
        "layer_id": layer_id,
        "center": {"north": excavation.center_north, "east": excavation.center_east, "elev": excavation.center_elev, "x": center_x, "y": center_y},
        "bounds": {"min_x": min(xs) - pad_x, "max_x": max(xs) + pad_x, "min_y": min(ys) - pad_y, "max_y": max(ys) + pad_y},
        "outline": outline,
        "points": points,
        "gnss_points": gnss,
        "legend": [{"key": key, "color": color} for key, color in legend_keys.items()],
    }


def _outline(corners: list[dict]) -> list[dict]:
    if len(corners) < 3:
        return []
    cx = sum(point["east"] for point in corners) / len(corners)
    cy = sum(point["north"] for point in corners) / len(corners)
    ordered = sorted(corners, key=lambda point: math.atan2(point["north"] - cy, point["east"] - cx))
    return [{"x": point["x"], "y": point["y"], "east": point["east"], "north": point["north"]} for point in ordered]
