import base64
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session, selectinload

from app.constants import (
    COLUMN_LABELS,
    EXTENDED_REPORT_COLUMNS,
    METHOD_LABELS,
    MINIMAL_REPORT_COLUMNS,
)
from app.errors import AppError
from app.models import Excavation, Finding, Layer, Photo, Report, ReportTemplate, User
from app.repositories.findings import apply_filters, apply_sort, base_query
from app.services.audit_service import write_audit
from app.services.domain import get_excavation
from app.services.plan_service import build_plan
from app.utils.exporters import build_album_pdf, build_formal_pdf, build_formal_xlsx, build_pdf, build_xlsx
from app.utils.files import report_root, resolve_storage_path
from app.utils.plan_render import render_plan_png
from app.utils.report_templates import build_album_html, build_formal_inventory_html, build_inventory_html

logger = logging.getLogger("archaeology.report")
_SORTS = {"code", "number", "north", "east", "elev", "length_mm", "width_mm", "thickness_mm", "square", "layer", "combined", "excavation", "material", "measurement_method", "photo_present", "record_status", "created_at", "description", "find_type"}
_FORMAL_META = (
    "layout",
    "collection_name",
    "monument",
    "excavation_author",
    "source",
    "dating",
    "culture",
    "report_note",
    "inventory_no",
    "inventory_date",
    "approver_role",
    "approver_name",
    "place_time",
    "bibliography",
    "monument_summary",
)
FIELD_HEADERS = ["№ п/п", "Наименование предмета", "Кол-во ед.хр", "Материал", "Квадрат", "Пласт", "Прим."]
FIELD_KEYS = ["seq", "name", "quantity", "material", "square", "layer", "note"]
COLLECTION_HEADERS = [
    "№ п/п",
    "Наименование",
    "Размеры",
    "Цвет в изломе",
    "Орнамент",
    "Обработка поверхности",
    "№ по полевой описи",
    "Количество ед. хр.",
    "Материал",
    "Сохранность",
    "Квадрат",
    "Пласт",
    "Полевой шифр",
    "Примечание",
]
COLLECTION_KEYS = [
    "seq",
    "name",
    "sizes",
    "fracture_color",
    "ornament",
    "surface_treatment",
    "field_number",
    "quantity",
    "material",
    "condition",
    "square",
    "layer",
    "field_cipher",
    "note",
]


def _layout(request) -> str:
    value = getattr(request, "layout", None) or "working"
    if value not in {"working", "field", "collection", "album"}:
        raise AppError(400, "Вид отчёта: working, field, collection или album")
    return value


def _columns(request) -> list[str]:
    layout = _layout(request)
    if layout == "album":
        return []
    if layout == "field":
        return list(FIELD_KEYS)
    if layout == "collection":
        return list(COLLECTION_KEYS)
    if request.columns:
        unknown = [column for column in request.columns if column not in COLUMN_LABELS]
        if unknown:
            raise AppError(400, "Неизвестные колонки отчёта: " + ", ".join(unknown))
        return request.columns
    if request.preset == "extended":
        return list(EXTENDED_REPORT_COLUMNS)
    return list(MINIMAL_REPORT_COLUMNS)


def _params(request) -> dict:
    data = request.model_dump()
    keys = [
        "q", "photo_present", "date_from", "date_to", "ids",
        *_FORMAL_META,
        "excavation_id",
        "layer_id",
        "code",
        "material",
        "square",
        "find_type",
        "measurement_method",
        "number_from",
        "number_to",
        "elev_from",
        "elev_to",
    ]
    return {key: data.get(key) for key in keys}


def _cell(finding, column: str) -> str:
    if column == "excavation":
        excavation = finding.excavation
        return f"{excavation.code} ({excavation.year})" if excavation else ""
    if column == "layer":
        return "" if finding.layer is None else str(finding.layer.number)
    if column == "measurement_method":
        return METHOD_LABELS.get(finding.measurement_method, finding.measurement_method)
    if column == "photo_present":
        return "да" if finding.photo_present else "нет"
    value = getattr(finding, column, None)
    if value is None:
        return ""
    if column in {"north", "east", "elev"}:
        return f"{float(value):.3f}"
    if column in {"length_mm", "width_mm", "thickness_mm", "depth_cm"}:
        return f"{float(value):.1f}"
    return str(value)


def _mm_to_cm_part(value: float | None) -> str | None:
    if value is None:
        return None
    text = f"{float(value) / 10.0:.1f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


def _sizes_cm(finding) -> str:
    parts = [_mm_to_cm_part(getattr(finding, key, None)) for key in ("length_mm", "width_mm", "thickness_mm")]
    parts = [part for part in parts if part]
    return "×".join(parts)


def _item_name(finding) -> str:
    return (finding.description or finding.find_type or "").strip()


def _field_cipher(finding) -> str:
    excavation = finding.excavation
    code = excavation.code if excavation else (finding.code or "")
    layer = "" if finding.layer is None else str(finding.layer.number)
    if code and layer:
        return f"{code}/{layer}/{finding.number}"
    if code:
        return f"{code}/{finding.number}"
    return str(finding.number)


def _formal_row(finding, index: int, layout: str) -> list[str]:
    layer = "" if finding.layer is None else str(finding.layer.number)
    if layout == "field":
        return [
            str(index),
            _item_name(finding),
            str(finding.quantity or 1),
            finding.material or "",
            finding.square or "",
            layer,
            finding.note or "",
        ]
    return [
        str(index),
        _item_name(finding),
        _sizes_cm(finding),
        finding.fracture_color or "",
        finding.ornament or "",
        finding.surface_treatment or "",
        str(finding.number),
        str(finding.quantity or 1),
        finding.material or "",
        "",
        finding.square or "",
        layer,
        _field_cipher(finding),
        finding.note or "",
    ]


def _meta(db: Session, params: dict, total: int) -> list[str]:
    lines = []
    for key, label in (
        ("collection_name", "Коллекция"),
        ("monument", "Памятник"),
        ("excavation_author", "Автор раскопок"),
        ("source", "Источник поступления"),
        ("dating", "Датировка"),
        ("culture", "Культурная принадлежность"),
        ("place_time", "Время и место нахождения"),
        ("bibliography", "Библиография"),
        ("monument_summary", "Краткие сведения о памятнике"),
        ("inventory_no", "Номер описи"),
        ("inventory_date", "Дата описи"),
        ("approver_role", "Должность утверждающего"),
        ("approver_name", "ФИО утверждающего"),
        ("report_note", "Примечания"),
        ("q", "Поиск"),
        ("date_from", "Регистрация с (UTC)"),
        ("date_to", "Регистрация по (UTC)"),
    ):
        if params.get(key):
            lines.append(f"{label}: {params[key]}")
    if params.get("photo_present") is not None:
        lines.append("Наличие фото: " + ("есть" if params["photo_present"] else "нет"))
    if params.get("ids") is not None:
        lines.append("Отбор: отмеченные записи")
    if params.get("excavation_id"):
        excavation = get_excavation(db, params["excavation_id"])
        lines.append(f"Раскоп: {excavation.code}, год: {excavation.year}")
        if excavation.description:
            lines.append(f"Описание раскопа: {excavation.description}")
    else:
        lines.append("Раскоп: все доступные")
    if params.get("layer_id"):
        lines.append(f"Пласт id: {params['layer_id']}")
    for label, key in (
        ("Квадрат", "square"),
        ("Материал", "material"),
        ("Тип находки", "find_type"),
        ("Код", "code"),
        ("Способ измерения", "measurement_method"),
    ):
        if params.get(key):
            value = params[key]
            if key == "measurement_method":
                value = METHOD_LABELS.get(value, value)
            lines.append(f"{label}: {value}")
    if params.get("number_from") is not None or params.get("number_to") is not None:
        lines.append(f"Номера: {params['number_from'] if params.get('number_from') is not None else '…'} - {params['number_to'] if params.get('number_to') is not None else '…'}")
    if params.get("elev_from") is not None or params.get("elev_to") is not None:
        lines.append(f"Elev: {params['elev_from'] if params.get('elev_from') is not None else '…'} - {params['elev_to'] if params.get('elev_to') is not None else '…'}")
    lines.append(f"Записей в выборке: {total}")
    return lines


def _epoch_line(params: dict) -> str:
    parts = [params.get("culture"), params.get("dating")]
    return ", ".join(part for part in parts if part)


def _requisites(params: dict, total: int, layout: str) -> list[tuple[str, str]]:
    rows = [
        ("Название коллекции", params.get("collection_name") or ""),
        ("Название памятника", params.get("monument") or ""),
        ("Количество предметов в коллекции по описи", f"{total} ед.хр"),
        ("Время и место нахождения, сбора или приобретения", params.get("place_time") or ""),
        ("Автор раскопок", params.get("excavation_author") or ""),
        ("Источник поступления коллекции", params.get("source") or ""),
        ("Эпоха, культурная принадлежность, датировка", _epoch_line(params)),
        ("Библиография", params.get("bibliography") or ""),
    ]
    if layout == "collection":
        rows.append(("Краткие сведения об объекте исследования и памятника", params.get("monument_summary") or params.get("report_note") or ""))
    elif params.get("report_note"):
        rows.append(("Примечания", params["report_note"]))
    return [(label, value) for label, value in rows if value or label.startswith("Количество")]


def _collect(db: Session, request, limit: int | None):
    params = _params(request)
    layout = _layout(request)
    if request.date_from and request.date_to and request.date_from > request.date_to:
        raise AppError(400, "Начало периода не может быть позже окончания")
    sort = request.sort if request.sort in _SORTS else "number"
    order = request.order if request.order in {"asc", "desc"} else "asc"
    filtered = apply_filters(base_query(db), params)
    total = filtered.count()
    if limit is None and total > 5000:
        raise AppError(400, "Слишком большая выборка. Уточните фильтры, лимит экспорта - 5000 записей.")
    query = apply_sort(filtered, sort, order)
    if limit is not None:
        query = query.limit(limit)
    findings = query.all()
    columns = _columns(request)
    if layout == "album":
        headers = ["№", "Подпись"]
        rows = []
    elif layout == "field":
        headers = list(FIELD_HEADERS)
        rows = [_formal_row(finding, index, layout) for index, finding in enumerate(findings, start=1)]
    elif layout == "collection":
        headers = list(COLLECTION_HEADERS)
        rows = [_formal_row(finding, index, layout) for index, finding in enumerate(findings, start=1)]
    else:
        headers = [COLUMN_LABELS[column] for column in columns]
        rows = [[_cell(finding, column) for column in columns] for finding in findings]
    return params, columns, headers, rows, total, sort, order, layout


def _photo_priority(photo: Photo) -> tuple[int, int]:
    order = {"finding": 0, "detail": 1, "layer": 2, "excavation": 3}
    return order.get(photo.photo_type, 9), photo.id or 0


def _read_photo_bytes(photo: Photo) -> bytes | None:
    if not photo.file_path:
        return None
    try:
        path = resolve_storage_path(photo.file_path)
    except AppError:
        return None
    if not path.exists():
        return None
    return path.read_bytes()


def _album_place_line(params: dict, excavation) -> str:
    parts = []
    if params.get("place_time"):
        parts.append(str(params["place_time"]))
    if params.get("monument"):
        parts.append(f"ОАН «{params['monument']}»")
    parts.append(f"раскоп {excavation.code}, {excavation.year} г.")
    return ". ".join(parts)


def _finding_album_texts(finding, fig_no: int, place_line: str, photo: Photo) -> dict:
    name = (finding.description or finding.find_type or "Находка").strip()
    heading = f"Рис. {fig_no}. {name}"
    caption = place_line
    details = [
        f"Полевой шифр: {finding.code}-{finding.number}",
    ]
    if finding.find_type:
        details.append(f"Тип: {finding.find_type}")
    if finding.material:
        details.append(f"Материал: {finding.material}")
    place = []
    if finding.square:
        place.append(f"кв. {finding.square}")
    if finding.layer is not None:
        place.append(f"пласт {finding.layer.number}")
    if place:
        details.append("Местонахождение: " + ", ".join(place))
    sizes = []
    for label, attr in (("длина", "length_mm"), ("ширина", "width_mm"), ("толщина", "thickness_mm")):
        value = getattr(finding, attr, None)
        if value is not None:
            sizes.append(f"{label} {float(value):.1f} мм")
    if sizes:
        details.append("Размеры: " + ", ".join(sizes))
    if finding.ornament:
        details.append(f"Орнамент: {finding.ornament}")
    if finding.full_desc:
        text = finding.full_desc.strip()
        if len(text) > 400:
            text = text[:397] + "…"
        details.append(f"Описание: {text}")
    elif finding.description and finding.find_type and finding.description != finding.find_type:
        details.append(f"Описание: {finding.description.strip()}")
    if photo.photo_type:
        details.append(f"Категория снимка: {photo.photo_type}")
    if photo.original_name:
        details.append(f"Файл: {photo.original_name}")
    return {"heading": heading, "caption": caption, "details": "\n".join(details)}


def _album_meta_lines(params: dict, excavation) -> list[str]:
    lines = []
    for key, label in (
        ("monument", "Памятник"),
        ("collection_name", "Коллекция"),
        ("place_time", "Место и время работ"),
        ("excavation_author", "Автор раскопок"),
        ("dating", "Датировка"),
        ("culture", "Культурная принадлежность"),
        ("source", "Основание работ"),
        ("report_note", "Примечание"),
    ):
        if params.get(key):
            lines.append(f"{label}: {params[key]}")
    if excavation.description:
        lines.append(f"Описание раскопа: {excavation.description}")
    lines.append(f"Раскоп: {excavation.code}, сезон {excavation.year}")
    return lines


def _build_album_figures(db: Session, request, params: dict) -> tuple[list[dict], str, str, list[str]]:
    if not params.get("excavation_id"):
        raise AppError(400, "Для альбома иллюстраций укажите раскоп")
    excavation = get_excavation(db, params["excavation_id"])
    title = request.title.strip() if request.title else f"Альбом иллюстраций. Раскоп {excavation.code}, {excavation.year}"
    subtitle = params.get("monument") or excavation.description or f"Материалы раскопа {excavation.code}"
    place_line = _album_place_line(params, excavation)
    meta_lines = _album_meta_lines(params, excavation)

    figures: list[dict] = []
    plan = build_plan(db, excavation.id, params.get("layer_id"), "ne", None)
    plan_png = render_plan_png(plan)
    layer_text = ""
    if params.get("layer_id"):
        layer_row = db.get(Layer, params["layer_id"])
        if layer_row:
            layer_text = f", пласт {layer_row.number}"
    point_count = len(plan.get("points") or [])
    figures.append(
        {
            "image": plan_png,
            "heading": f"Рис. 1. План раскопа {plan['excavation_code']} ({plan['year']}), вид N–E{layer_text}",
            "caption": place_line,
            "details": "\n".join(
                [
                    f"Точек находок на плане: {point_count}",
                    f"Окраска: {plan.get('color_by') or 'material'}",
                    "Условные обозначения приведены в легенде на плане.",
                ]
            ),
        }
    )

    sort = request.sort if request.sort in _SORTS else "number"
    order = request.order if request.order in {"asc", "desc"} else "asc"
    filtered = apply_filters(base_query(db), params)
    query = apply_sort(filtered, sort, order).options(selectinload(Finding.photos))
    findings = query.limit(200).all()
    fig_no = 2
    for finding in findings:
        photos = sorted(finding.photos or [], key=_photo_priority)
        used = 0
        for photo in photos:
            data = _read_photo_bytes(photo)
            if not data:
                continue
            texts = _finding_album_texts(finding, fig_no, place_line, photo)
            figures.append({"image": data, **texts})
            fig_no += 1
            used += 1
            if used >= 2 or fig_no > 81:
                break
        if fig_no > 81:
            break
    return figures, title, subtitle, meta_lines


def _title(request, params, db: Session) -> str:
    if request.title:
        return request.title.strip()
    layout = params.get("layout") or "working"
    inventory_no = params.get("inventory_no")
    inventory_date = params.get("inventory_date")
    suffix = ""
    if inventory_no:
        suffix = f" № {inventory_no}"
        if inventory_date:
            suffix += f" от {inventory_date}"
    if layout == "album":
        if params.get("excavation_id"):
            excavation = db.get(Excavation, params["excavation_id"])
            if excavation:
                return f"Альбом иллюстраций. Раскоп {excavation.code}, {excavation.year}"
        return "Альбом иллюстраций"
    if layout == "collection":
        base = f"КОЛЛЕКЦИОННАЯ ОПИСЬ{suffix} археологических предметов"
    elif layout == "field":
        base = f"ПОЛЕВАЯ ОПИСЬ{suffix} археологических предметов, выявленных в ходе раскопок"
    else:
        base = "Полевая опись археологических находок"
    if params.get("excavation_id") and layout == "working":
        excavation = db.get(Excavation, params["excavation_id"])
        if excavation:
            return f"Полевая опись. Раскоп {excavation.code}, {excavation.year}"
    return base


def _column_payload(columns: list[str], layout: str) -> list[dict]:
    if layout == "field":
        return [{"key": key, "label": label} for key, label in zip(FIELD_KEYS, FIELD_HEADERS)]
    if layout == "collection":
        return [{"key": key, "label": label} for key, label in zip(COLLECTION_KEYS, COLLECTION_HEADERS)]
    return [{"key": key, "label": COLUMN_LABELS[key]} for key in columns]


def preview_report(db: Session, request, actor: User) -> dict:
    layout = _layout(request)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    if layout == "album":
        params = _params(request)
        figures, title, subtitle, meta_lines = _build_album_figures(db, request, params)
        rows = [[str(index), figure.get("heading") or figure.get("caption") or ""] for index, figure in enumerate(figures, start=1)]
        html = build_album_html(
            title=title,
            subtitle=subtitle,
            meta_lines=meta_lines,
            figures=[{"heading": figure.get("heading"), "caption": figure.get("caption"), "details": figure.get("details"), "data_url": ""} for figure in figures],
            generated_at=generated,
            author=actor.full_name,
        )
        write_audit(db, user_id=actor.id, action="report_preview", entity="report", details=title, commit=True)
        return {
            "title": title,
            "total": len(figures),
            "layout": layout,
            "columns": [{"key": "n", "label": "№"}, {"key": "caption", "label": "Подпись"}],
            "rows": rows,
            "preview_limit": len(figures),
            "sort": request.sort,
            "order": request.order,
            "html": html,
            "subtitle": subtitle,
        }

    params, columns, headers, rows, total, sort, order, layout = _collect(db, request, limit=100)
    title = _title(request, params, db)
    if layout in {"field", "collection"}:
        html = build_formal_inventory_html(
            title=title,
            approver_role=params.get("approver_role") or "",
            approver_name=params.get("approver_name") or "",
            inventory_date=params.get("inventory_date") or "",
            requisites=_requisites(params, total, layout),
            headers=headers,
            rows=rows,
            total=total,
            generated_at=generated,
            author=actor.full_name,
        )
    else:
        html = build_inventory_html(
            title=title,
            meta_lines=_meta(db, params, total),
            headers=headers,
            rows=rows,
            total=total,
            generated_at=generated,
            author=actor.full_name,
        )
    write_audit(db, user_id=actor.id, action="report_preview", entity="report", details=title, commit=True)
    return {
        "title": title,
        "total": total,
        "layout": layout,
        "columns": _column_payload(columns, layout),
        "rows": rows,
        "preview_limit": 100,
        "sort": sort,
        "order": order,
        "html": html,
    }


def _store_report(
    db: Session,
    actor: User,
    title: str,
    params: dict,
    columns: list[str],
    fmt: str,
    path: str | None,
    report_type: str = "inventory",
) -> Report:
    report = Report(
        title=title,
        excavation_id=params.get("excavation_id"),
        report_type=report_type,
        file_path=path,
        format=fmt,
        filters_json=json.dumps(params, ensure_ascii=False, default=str),
        columns_json=json.dumps(columns, ensure_ascii=False),
        status="draft",
        created_by_id=actor.id,
    )
    db.add(report)
    db.flush()
    write_audit(db, user_id=actor.id, action="report_export", entity="report", entity_id=report.id, details=f"{fmt}:{title}")
    db.commit()
    db.refresh(report)
    logger.info("report id=%s format=%s", report.id, fmt)
    return report


def export_report(db: Session, request, actor: User) -> tuple[bytes, str, str, int]:
    layout = _layout(request)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    if layout == "album":
        if request.format not in {None, "pdf"}:
            raise AppError(400, "Альбом иллюстраций формируется только в PDF")
        params = _params(request)
        figures, title, subtitle, meta_lines = _build_album_figures(db, request, params)
        payload = build_album_pdf(
            title=title,
            subtitle=subtitle,
            meta_lines=meta_lines,
            figures=figures,
            generated_at=generated,
            author=actor.full_name,
        )
        excavation = db.get(Excavation, params["excavation_id"])
        code = excavation.code if excavation else "album"
        safe = re.sub(r"[^A-Za-z0-9_-]+", "_", code) or "album"
        stamp = datetime.now().strftime("%Y%m%d")
        filename = f"album_{safe}_{stamp}.pdf"
        relative = f"{uuid.uuid4().hex}_{filename}"
        (report_root() / relative).write_bytes(payload)
        report = _store_report(db, actor, title, params, [], "pdf", relative, report_type="album")
        return payload, filename, "application/pdf", report.id

    params, columns, headers, rows, total, _sort, _order, layout = _collect(db, request, limit=None)
    title = _title(request, params, db)
    fmt = request.format
    code = "opis"
    if params.get("excavation_id"):
        excavation = db.get(Excavation, params["excavation_id"])
        if excavation:
            code = excavation.code
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", code) or "opis"
    stamp = datetime.now().strftime("%Y%m%d")
    kind = {"field": "polevaya", "collection": "kollekcionnaya"}.get(layout, "opis")
    if layout in {"field", "collection"}:
        requisites = _requisites(params, total, layout)
        common = dict(
            title=title,
            approver_role=params.get("approver_role") or "",
            approver_name=params.get("approver_name") or "",
            inventory_date=params.get("inventory_date") or "",
            requisites=requisites,
            headers=headers,
            rows=rows,
        )
        if fmt == "xlsx":
            payload = build_formal_xlsx(**common)
            filename = f"{kind}_{safe}_{stamp}.xlsx"
            media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif fmt == "pdf":
            payload = build_formal_pdf(**common, generated_at=generated)
            filename = f"{kind}_{safe}_{stamp}.pdf"
            media = "application/pdf"
        else:
            raise AppError(400, "Формат экспорта: xlsx или pdf")
    else:
        meta = _meta(db, params, total)
        if fmt == "xlsx":
            payload = build_xlsx(title, meta, headers, rows)
            filename = f"opis_{safe}_{stamp}.xlsx"
            media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif fmt == "pdf":
            payload = build_pdf(title, meta, headers, rows, generated)
            filename = f"opis_{safe}_{stamp}.pdf"
            media = "application/pdf"
        else:
            raise AppError(400, "Формат экспорта: xlsx или pdf")
    relative = f"{uuid.uuid4().hex}_{filename}"
    (report_root() / relative).write_bytes(payload)
    report = _store_report(db, actor, title, params, columns, fmt, relative)
    return payload, filename, media, report.id


def print_report(db: Session, request, actor: User) -> str:
    layout = _layout(request)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    if layout == "album":
        params = _params(request)
        figures, title, subtitle, meta_lines = _build_album_figures(db, request, params)
        html_figures = []
        for figure in figures:
            raw = figure["image"]
            mime = "image/png" if raw.startswith(b"\x89PNG") else "image/jpeg"
            encoded = base64.b64encode(raw).decode("ascii")
            html_figures.append(
                {
                    "heading": figure.get("heading"),
                    "caption": figure.get("caption"),
                    "details": figure.get("details"),
                    "data_url": f"data:{mime};base64,{encoded}",
                }
            )
        html = build_album_html(
            title=title,
            subtitle=subtitle,
            meta_lines=meta_lines,
            figures=html_figures,
            generated_at=generated,
            author=actor.full_name,
        )
        _store_report(db, actor, title, params, [], "html", None, report_type="album")
        return html

    params, columns, headers, rows, total, _sort, _order, layout = _collect(db, request, limit=None)
    title = _title(request, params, db)
    if layout in {"field", "collection"}:
        html = build_formal_inventory_html(
            title=title,
            approver_role=params.get("approver_role") or "",
            approver_name=params.get("approver_name") or "",
            inventory_date=params.get("inventory_date") or "",
            requisites=_requisites(params, total, layout),
            headers=headers,
            rows=rows,
            total=total,
            generated_at=generated,
            author=actor.full_name,
        )
    else:
        html = build_inventory_html(
            title=title,
            meta_lines=_meta(db, params, total),
            headers=headers,
            rows=rows,
            total=total,
            generated_at=generated,
            author=actor.full_name,
        )
    _store_report(db, actor, title, params, columns, "html", None)
    return html


def list_templates(db: Session) -> list[dict]:
    rows = db.query(ReportTemplate).order_by(ReportTemplate.name).all()
    return [_template_dict(row) for row in rows]


def _template_dict(row: ReportTemplate) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "filters": json.loads(row.filters_json or "{}"),
        "columns": json.loads(row.columns_json or "[]"),
        "sort": json.loads(row.sort_json or "{}"),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def save_template(db: Session, data, actor: User) -> dict:
    name = data.name.strip()
    existing = (
        db.query(ReportTemplate)
        .filter(ReportTemplate.created_by_id == actor.id, ReportTemplate.name == name)
        .one_or_none()
    )
    payload_filters = json.dumps(data.filters, ensure_ascii=False, default=str)
    payload_columns = json.dumps(data.columns, ensure_ascii=False)
    payload_sort = json.dumps(data.sort, ensure_ascii=False)
    if existing:
        existing.filters_json = payload_filters
        existing.columns_json = payload_columns
        existing.sort_json = payload_sort
        existing.updated_at = datetime.now(timezone.utc)
        row = existing
        action = "update"
    else:
        row = ReportTemplate(
            name=name,
            filters_json=payload_filters,
            columns_json=payload_columns,
            sort_json=payload_sort,
            created_by_id=actor.id,
        )
        db.add(row)
        action = "create"
    db.flush()
    write_audit(db, user_id=actor.id, action=action, entity="report_template", entity_id=row.id, details=name)
    db.commit()
    db.refresh(row)
    return _template_dict(row)


def delete_template(db: Session, template_id: int, actor: User) -> None:
    row = db.get(ReportTemplate, template_id)
    if row is None:
        raise AppError(404, "Шаблон отчёта не найден")
    if row.created_by_id not in {None, actor.id} and actor.role != "supervisor":
        raise AppError(403, "Можно удалить только свой шаблон")
    write_audit(db, user_id=actor.id, action="delete", entity="report_template", entity_id=row.id, details=row.name)
    db.delete(row)
    db.commit()


def confirm_report(db: Session, report_id: int, actor: User) -> dict:
    report = db.get(Report, report_id)
    if report is None:
        raise AppError(404, "Отчёт не найден")
    report.status = "confirmed"
    write_audit(db, user_id=actor.id, action="confirm", entity="report", entity_id=report.id, details=report.title)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "title": report.title, "status": report.status, "format": report.format, "created_at": report.created_at}


def list_reports(db: Session) -> list[dict]:
    rows = db.query(Report).order_by(Report.id.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "format": row.format,
            "status": row.status,
            "excavation_id": row.excavation_id,
            "created_at": row.created_at,
        }
        for row in rows
    ]
