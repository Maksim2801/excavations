ROLE_FIELD = "field_archaeologist"
ROLE_CAMERA = "camera_staff"
ROLE_SUPERVISOR = "supervisor"
ROLES = (ROLE_FIELD, ROLE_CAMERA, ROLE_SUPERVISOR)
ROLE_LABELS = {
    ROLE_FIELD: "Полевой археолог",
    ROLE_CAMERA: "Камеральный сотрудник",
    ROLE_SUPERVISOR: "Руководитель работ",
}

EXCAVATION_ACTIVE = "active"
EXCAVATION_ARCHIVED = "archived"

LAYER_OPEN = "open"
LAYER_RECORDED = "recorded"
LAYER_CLOSED = "closed"

METHOD_NONE = "none"
METHOD_PHOTO = "photo"
METHOD_MANUAL = "manual"
MEASUREMENT_METHODS = (METHOD_NONE, METHOD_PHOTO, METHOD_MANUAL)

RECORD_DRAFT = "draft"
RECORD_COMPLETE = "complete"

GNSS_CORNER = "corner"
GNSS_CONTROL = "control"
GNSS_AUXILIARY = "auxiliary"
GNSS_TYPES = (GNSS_CORNER, GNSS_CONTROL, GNSS_AUXILIARY)
GNSS_TYPE_LABELS = {
    GNSS_CORNER: "Угловая",
    GNSS_CONTROL: "Контрольная",
    GNSS_AUXILIARY: "Вспомогательная",
}

PHOTO_FINDING = "finding"
PHOTO_LAYER = "layer"
PHOTO_EXCAVATION = "excavation"
PHOTO_DETAIL = "detail"
PHOTO_TYPES = (PHOTO_FINDING, PHOTO_LAYER, PHOTO_EXCAVATION, PHOTO_DETAIL)

MEASURE_LENGTH = "length"
MEASURE_WIDTH = "width"
MEASURE_THICKNESS = "thickness"
MEASURE_TYPES = (MEASURE_LENGTH, MEASURE_WIDTH, MEASURE_THICKNESS)

SOURCE_AUTO = "auto_marker"
SOURCE_USER_POINTS = "user_points"
SOURCE_MANUAL = "manual"

STATUS_DETECTED = "detected"
STATUS_MANUAL = "manual_correction_required"
STATUS_NOT_FOUND = "marker_not_found"

ISSUE_COORDINATES = "no_coordinates"
ISSUE_DIMENSIONS = "no_dimensions"
ISSUE_PHOTO = "no_photo"
ISSUE_LAYER = "no_layer"
ISSUE_INCOMPLETE = "incomplete"

MINIMAL_REPORT_COLUMNS = [
    "code",
    "number",
    "excavation",
    "layer",
    "square",
    "material",
    "north",
    "east",
    "elev",
    "length_mm",
    "width_mm",
    "thickness_mm",
]
EXTENDED_REPORT_COLUMNS = MINIMAL_REPORT_COLUMNS + [
    "description",
    "find_type",
    "quantity",
    "measurement_method",
    "photo_present",
    "vessel_part",
    "ornament",
    "surface_color",
    "note",
    "pt",
    "depth_cm",
]

COLUMN_LABELS = {
    "code": "Код",
    "number": "Номер",
    "excavation": "Раскоп",
    "layer": "Пласт",
    "square": "Квадрат",
    "material": "Материал",
    "north": "North",
    "east": "East",
    "elev": "Elev",
    "length_mm": "Длина, мм",
    "width_mm": "Ширина, мм",
    "thickness_mm": "Толщина, мм",
    "description": "Описание",
    "find_type": "Тип находки",
    "quantity": "Количество",
    "measurement_method": "Способ измерения",
    "photo_present": "Фото",
    "vessel_part": "Часть сосуда",
    "ornament": "Орнамент",
    "surface_color": "Цвет поверхности",
    "fracture_color": "Цвет в изломе",
    "fabric": "Структура",
    "temper": "Примесь",
    "surface_treatment": "Обработка поверхности",
    "note": "Примечание",
    "pt": "Pt",
    "depth_cm": "Глубина, см",
}

METHOD_LABELS = {
    METHOD_NONE: "не указан",
    METHOD_PHOTO: "по фото",
    METHOD_MANUAL: "ручное",
}

LAYER_PALETTE = ["#8c3a2f", "#2f6b4f", "#3d7ea6", "#a16207", "#6b4c7a", "#4f6b4a", "#8a5a44", "#3f5f73"]

MATERIALS = [
    {"name": "керамика", "code": "ceramic", "color": "#2f6b4f"},
    {"name": "металл", "code": "metal", "color": "#a16207"},
    {"name": "кость", "code": "bone", "color": "#c4a574"},
    {"name": "камень", "code": "stone", "color": "#5c6b73"},
    {"name": "стекло", "code": "glass", "color": "#3d7ea6"},
    {"name": "кремень", "code": "flint", "color": "#6b5b4b"},
    {"name": "дерево", "code": "wood", "color": "#7a5a3a"},
    {"name": "глина", "code": "clay", "color": "#8d5a4a"},
]

PHOTO_TYPE_ROWS = [
    {"code": PHOTO_FINDING, "name": "Находка"},
    {"code": PHOTO_LAYER, "name": "Пласт"},
    {"code": PHOTO_EXCAVATION, "name": "Раскоп"},
    {"code": PHOTO_DETAIL, "name": "Деталь"},
]

GNSS_TYPE_ROWS = [
    {"code": GNSS_CORNER, "name": "Угловая"},
    {"code": GNSS_CONTROL, "name": "Контрольная"},
    {"code": GNSS_AUXILIARY, "name": "Вспомогательная"},
]

MEASUREMENT_METHOD_ROWS = [
    {"code": METHOD_NONE, "name": "Не указан"},
    {"code": METHOD_PHOTO, "name": "По фото"},
    {"code": METHOD_MANUAL, "name": "Ручное"},
]
