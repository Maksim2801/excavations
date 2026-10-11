"""Демонстрационные пользователи, раскопы, находки, фото и GNSS-точки."""

import uuid
from datetime import date

from PIL import Image

from app.database import SessionLocal
from app.models import ExcavationMember, Finding, GNSSPoint, Measurement, Photo, User
from app.schemas.io import ExcavationIn, FindingIn, LayerIn
from app.services.domain import refresh_record_status
from app.services.excavation_service import create_excavation
from app.services.finding_service import create_finding
from app.services.layer_service import create_layer
from app.services.user_service import create_user_record
from app.utils.demo_image import render_scale_photo
from app.utils.files import upload_root
from app.utils.geometry import point_element
from app.utils.measurement import calculate_measurement

USERS = [
    ("field_arch", "FieldArch1", "Анна Полевая", "field_archaeologist"),
    ("camera_arch", "CameraArch1", "Борис Камеральный", "camera_staff"),
    ("supervisor_arch", "SuperArch1", "Мария Руководитель", "supervisor"),
]

EXCAVATIONS = [
    {
        "code": "R-1",
        "year": 2024,
        "center_north": 1010,
        "center_east": 2010,
        "center_elev": 150.1,
        "description": "Раскоп на площадке городища, сетка 5×5 м.",
        "area_m2": 400,
        "grid_step_m": 5,
        "boundaries": "Северо-западный угол принят за опорный.",
        "layers": [
            (1, 150.40, 150.20, "Гумус", "тёмно-коричневый", "Рыхлый тёмный гумус, углистые включения."),
            (2, 150.20, 150.00, "Суглинок", "серо-коричневый", "Плотный суглинок с прокалённой глиной."),
            (3, 150.00, 149.75, "Материк", "светло-жёлтый", "Светло-жёлтый материковый суглинок."),
        ],
        "corners": [(1020, 2000, 150.3), (1020, 2020, 150.3), (1000, 2020, 150.28), (1000, 2000, 150.32)],
    },
    {
        "code": "SH-2",
        "year": 2025,
        "center_north": 500,
        "center_east": 800,
        "center_elev": 120.0,
        "description": "Шурф у склона, контрольная зачистка.",
        "area_m2": 100,
        "grid_step_m": 5,
        "boundaries": "Контур снят GNSS-приёмником.",
        "layers": [
            (1, 120.20, 120.00, "Дёрн", "серый", "Дёрн и современный мусор."),
            (2, 120.00, 119.80, "Культурный слой", "коричневый", "Коричневый культурный слой."),
        ],
        "corners": [(510, 790, 120.2), (510, 810, 120.18), (490, 810, 120.16), (490, 790, 120.19)],
    },
]

FINDINGS = [
    {"ex": 0, "layer": 1, "code": "R1", "number": 1, "north": 1008, "east": 2006, "elev": 150.31, "square": "А1", "material": "керамика", "find_type": "фрагмент сосуда", "description": "Венчик лепного сосуда", "vessel_part": "венчик", "ornament": "насечки по краю", "length_mm": 80, "width_mm": 42, "thickness_mm": 9, "photo": True, "measure": True},
    {"ex": 0, "layer": 1, "code": "R1", "number": 2, "north": 1012, "east": 2008, "elev": 150.28, "square": "А1", "material": "кость", "find_type": "изделие", "description": "Костяное остриё", "length_mm": 64, "width_mm": 12, "thickness_mm": 8, "photo": True},
    {"ex": 0, "layer": 1, "code": "R1", "number": 3, "north": 1016, "east": 2014, "elev": 150.25, "square": "А2", "material": "кремень", "find_type": "отщеп", "description": "Кремнёвый отщеп", "length_mm": 28, "width_mm": 18, "thickness_mm": 5},
    {"ex": 0, "layer": 2, "code": "R1", "number": 4, "north": 1004, "east": 2012, "elev": 150.10, "square": "Б1", "material": "металл", "find_type": "нож", "description": "Обломок железного ножа", "length_mm": 92, "width_mm": 18, "thickness_mm": 4, "photo": True},
    {"ex": 0, "layer": 2, "code": "R1", "number": 5, "north": 1006, "east": 2016, "elev": 150.05, "square": "Б1", "material": "керамика", "find_type": "фрагмент сосуда", "description": "Стенка с расчёсами", "surface_treatment": "расчёсы", "length_mm": 55, "width_mm": 40, "thickness_mm": 7},
    {"ex": 0, "layer": 2, "code": "R1", "number": 6, "north": 1014, "east": 2004, "elev": 150.08, "square": "Б2", "material": "стекло", "find_type": "бусина", "description": "Синяя стеклянная бусина", "length_mm": 8, "width_mm": 8, "thickness_mm": 8},
    {"ex": 0, "layer": 3, "code": "R1", "number": 7, "north": 1002, "east": 2002, "elev": 149.90, "square": "В1", "material": "камень", "find_type": "грузило", "description": "Каменное грузило с отверстием"},
    {"ex": 0, "layer": 3, "code": "R1", "number": 8, "north": 1018, "east": 2018, "elev": 149.86, "square": "В2", "material": "глина", "find_type": "обмазка", "description": "Фрагмент обмазки", "length_mm": 40, "width_mm": 30, "thickness_mm": 15, "photo": True},
    {"ex": 0, "layer": 1, "code": "R1", "number": 9, "square": "А2", "material": "керамика", "find_type": "фрагмент сосуда", "description": "Стенка без координат", "length_mm": 33, "width_mm": 21, "thickness_mm": 6},
    {"ex": 0, "layer": None, "code": "R1", "number": 10, "north": 1010, "east": 2010, "elev": 150.15, "square": "А1", "material": "кость", "find_type": "фрагмент", "description": "Кость без привязки к пласту"},
    {"ex": 0, "layer": 2, "code": "R1", "number": 11, "north": 1100, "east": 2005, "elev": 150.02, "square": "Г1", "material": "металл", "find_type": "шлак", "description": "Шлак вне контура раскопа", "length_mm": 22, "width_mm": 16, "thickness_mm": 10},
    {"ex": 0, "layer": 1, "code": "R1", "number": 12, "north": 1009, "east": 2011, "elev": 150.33, "square": "А1", "material": "дерево", "find_type": "уголь", "description": "Фрагмент обугленного дерева"},
    {"ex": 1, "layer": 1, "code": "S2", "number": 1, "north": 502, "east": 798, "elev": 120.12, "square": "1", "material": "керамика", "find_type": "фрагмент сосуда", "description": "Край миски", "length_mm": 48, "width_mm": 36, "thickness_mm": 6, "photo": False},
    {"ex": 1, "layer": 1, "code": "S2", "number": 2, "north": 506, "east": 804, "elev": 120.08, "square": "1", "material": "кремень", "find_type": "пластина", "description": "Кремнёвая пластина", "length_mm": 31, "width_mm": 11, "thickness_mm": 3},
    {"ex": 1, "layer": 2, "code": "S2", "number": 3, "north": 496, "east": 802, "elev": 119.92, "square": "2", "material": "кость", "find_type": "астрагал", "description": "Астрагал со следами обработки", "length_mm": 29, "width_mm": 18, "thickness_mm": 14},
    {"ex": 1, "layer": 2, "code": "S2", "number": 4, "north": 498, "east": 796, "elev": 119.88, "square": "2", "material": "камень", "find_type": "плитка", "description": "Плитка без размеров"},
    {"ex": 1, "layer": 1, "code": "S2", "number": 5, "north": 504, "east": 808, "elev": 120.05, "square": "1", "material": "стекло", "find_type": "осколок", "description": "Осколок сосуда", "length_mm": 18, "width_mm": 12, "thickness_mm": 2},
    {"ex": 1, "layer": 2, "code": "S2", "number": 6, "north": 492, "east": 800, "elev": 119.95, "square": "2", "material": "керамика", "find_type": "пряслице", "description": "Обломок пряслица", "length_mm": 26, "width_mm": 20, "thickness_mm": 9},
]


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(User).first():
            print("seed: демонстрационные данные уже загружены")
            return
        users = {}
        for username, password, full_name, role in USERS:
            users[role] = create_user_record(
                db,
                username=username,
                password=password,
                full_name=full_name,
                role=role,
            )
        supervisor = users["supervisor"]
        field_user = users["field_archaeologist"]
        excavations = []
        layer_map = []
        for item in EXCAVATIONS:
            excavation = create_excavation(
                db,
                ExcavationIn(
                    code=item["code"],
                    year=item["year"],
                    center_north=item["center_north"],
                    center_east=item["center_east"],
                    center_elev=item["center_elev"],
                    description=item["description"],
                    area_m2=item["area_m2"],
                    grid_step_m=item["grid_step_m"],
                    boundaries=item["boundaries"],
                ),
                supervisor,
            )
            db.add(ExcavationMember(user_id=field_user.id, excavation_id=excavation["id"]))
            db.commit()
            excavations.append(excavation)
            numbers = {}
            for number, top, bottom, title, color, surface in item["layers"]:
                layer = create_layer(
                    db,
                    LayerIn(
                        excavation_id=excavation["id"],
                        number=number,
                        top_elev=top,
                        bottom_elev=bottom,
                        description=title,
                        color=["#8c3a2f", "#2f6b4f", "#c4a574"][(number-1) % 3],
                        surface_description=surface,
                        inclusions="уголь, прокал" if number < 3 else None,
                        interpretation=title,
                    ),
                    field_user,
                )
                numbers[number] = layer["id"]
            layer_map.append(numbers)
            for north, east, elev in item["corners"]:
                db.add(
                    GNSSPoint(
                        excavation_id=excavation["id"],
                        north=north,
                        east=east,
                        elev=elev,
                        point_type="corner",
                        comment="Угол раскопа",
                        source_name="demo.csv",
                        created_by_id=field_user.id,
                        geom=point_element(east, north, elev),
                    )
                )
            db.add(
                GNSSPoint(
                    excavation_id=excavation["id"],
                    north=item["center_north"],
                    east=item["center_east"],
                    elev=item["center_elev"],
                    point_type="control",
                    comment="Центр раскопа",
                    source_name="demo.csv",
                    created_by_id=field_user.id,
                    geom=point_element(item["center_east"], item["center_north"], item["center_elev"]),
                )
            )
            db.add(
                GNSSPoint(
                    excavation_id=excavation["id"],
                    north=item["center_north"] - 2,
                    east=item["center_east"] + 2,
                    elev=item["center_elev"] - 0.05,
                    point_type="auxiliary",
                    comment="Вспомогательная точка",
                    source_name="demo.csv",
                    created_by_id=field_user.id,
                    geom=point_element(item["center_east"] + 2, item["center_north"] - 2, item["center_elev"] - 0.05),
                )
            )
        db.commit()

        created = []
        for spec in FINDINGS:
            layer_id = None
            if spec.get("layer") is not None:
                layer_id = layer_map[spec["ex"]][spec["layer"]]
            payload = FindingIn(
                excavation_id=excavations[spec["ex"]]["id"],
                layer_id=layer_id,
                code=spec["code"],
                number=spec["number"],
                north=spec.get("north"),
                east=spec.get("east"),
                elev=spec.get("elev"),
                square=spec.get("square"),
                material=spec.get("material"),
                find_type=spec.get("find_type"),
                description=spec.get("description"),
                vessel_part=spec.get("vessel_part"),
                ornament=spec.get("ornament"),
                surface_treatment=spec.get("surface_treatment"),
                length_mm=spec.get("length_mm"),
                width_mm=spec.get("width_mm"),
                thickness_mm=spec.get("thickness_mm"),
                quantity=1,
            )
            created.append((spec, create_finding(db, payload, field_user)))

        measured = None
        for spec, finding in created:
            if not spec.get("photo"):
                continue
            photo = _store_photo(
                db,
                finding_id=finding["id"],
                layer_id=finding["layer_id"],
                excavation_id=finding["excavation_id"],
                photo_type="finding",
                author=field_user.full_name,
                has_scale=True,
                original_name=f"{finding['code']}-{finding['number']}.png",
            )
            row = db.get(Finding, finding["id"])
            row.photo_present = True
            refresh_record_status(row)
            if spec.get("measure"):
                measured = (row, photo)
        first_layer_id = layer_map[0][1]
        _store_photo(
            db,
            finding_id=None,
            layer_id=first_layer_id,
            excavation_id=excavations[0]["id"],
            photo_type="layer",
            author=field_user.full_name,
            has_scale=True,
            original_name="layer-1.png",
        )
        _store_photo(
            db,
            finding_id=None,
            layer_id=None,
            excavation_id=excavations[0]["id"],
            photo_type="excavation",
            author=supervisor.full_name,
            has_scale=False,
            original_name="excavation-r1.png",
        )
        if measured:
            row, photo = measured
            _store_measurement(db, row, photo.id, field_user.id)
            refresh_record_status(row)
        db.commit()
        print("seed: созданы пользователи, 2 раскопа, пласты, 18 находок, фото и GNSS-точки")
        print("seed: field_arch / FieldArch1, camera_arch / CameraArch1, supervisor_arch / SuperArch1")
    finally:
        db.close()


def _store_photo(db, **kwargs):
    root = upload_root()
    stored = f"{uuid.uuid4().hex}.png"
    render_scale_photo(root / stored)
    image = Image.open(root / stored)
    image.thumbnail((480, 480))
    thumb = f"thumb_{stored.replace('.png', '')}.jpg"
    image.convert("RGB").save(root / thumb, "JPEG", quality=80)
    photo = Photo(
        finding_id=kwargs["finding_id"],
        layer_id=kwargs["layer_id"],
        excavation_id=kwargs["excavation_id"],
        file_path=stored,
        thumb_path=thumb,
        original_name=kwargs["original_name"],
        photo_type=kwargs["photo_type"],
        author=kwargs["author"],
        shot_date=date.today(),
        has_scale=kwargs["has_scale"],
        mime_type="image/png",
        size_bytes=(root / stored).stat().st_size,
    )
    db.add(photo)
    db.flush()
    return photo


def _store_measurement(db, finding, photo_id: int, user_id: int) -> None:
    scale = [{"x": 100, "y": 78}, {"x": 500, "y": 78}]
    length = calculate_measurement(scale, [{"x": 160, "y": 240}, {"x": 460, "y": 240}], 100)
    width = calculate_measurement(scale, [{"x": 160, "y": 180}, {"x": 160, "y": 300}], 100)
    for measure_type, calculated in (("length", length), ("width", width)):
        db.add(
            Measurement(
                finding_id=finding.id,
                photo_id=photo_id,
                measurement_type=measure_type,
                method="photo",
                result_source="user_points",
                detection_status="detected",
                scale_pixel_distance=calculated["scale_pixel_distance"],
                scale_mm=100,
                object_pixel_distance=calculated["object_pixel_distance"],
                result_mm=calculated["result_mm"],
                points_json=calculated["points_json"],
                accepted=True,
                created_by_id=user_id,
            )
        )
        if measure_type == "length":
            finding.length_mm = calculated["result_mm"]
        else:
            finding.width_mm = calculated["result_mm"]
    finding.measurement_method = "photo"
    db.flush()


if __name__ == "__main__":
    seed()
