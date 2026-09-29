import json
import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.constants import (
    COLUMN_LABELS,
    EXTENDED_REPORT_COLUMNS,
    METHOD_LABELS,
    MINIMAL_REPORT_COLUMNS,
)
from app.errors import AppError
from app.models import Excavation, Report, ReportTemplate, User
from app.repositories.findings import apply_filters, apply_sort, base_query
from app.services.audit_service import write_audit
from app.services.domain import get_excavation
from app.utils.exporters import build_pdf, build_xlsx
from app.utils.files import report_root
from app.utils.report_templates import build_inventory_html

logger = logging.getLogger("archaeology.report")
_SORTS = {"code", "number", "north", "east", "elev", "length_mm", "width_mm", "thickness_mm", "square", "layer", "combined"}


def _columns(request) -> list[str]:
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
    return {key: data.get(key) for key in (
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
    )}


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


def _meta(db: Session, params: dict, total: int) -> list[str]:
    lines = []
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
        lines.append(f"Номера: {params.get('number_from') or '…'} - {params.get('number_to') or '…'}")
    if params.get("elev_from") is not None or params.get("elev_to") is not None:
        lines.append(f"Elev: {params.get('elev_from') or '…'} - {params.get('elev_to') or '…'}")
    lines.append(f"Записей в выборке: {total}")
    return lines


def _collect(db: Session, request, limit: int | None):
    params = _params(request)
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
    headers = [COLUMN_LABELS[column] for column in columns]
    rows = [[_cell(finding, column) for column in columns] for finding in findings]
    return params, columns, headers, rows, total, sort, order


def _title(request, params, db: Session) -> str:
    if request.title:
        return request.title.strip()
    if params.get("excavation_id"):
        excavation = db.get(Excavation, params["excavation_id"])
        if excavation:
            return f"Полевая опись. Раскоп {excavation.code}, {excavation.year}"
    return "Полевая опись археологических находок"


def preview_report(db: Session, request, actor: User) -> dict:
    params, columns, headers, rows, total, sort, order = _collect(db, request, limit=100)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    html = build_inventory_html(
        title=_title(request, params, db),
        meta_lines=_meta(db, params, total),
        headers=headers,
        rows=rows,
        total=total,
        generated_at=generated,
        author=actor.full_name,
    )
    write_audit(db, user_id=actor.id, action="report_preview", entity="report", details=_title(request, params, db), commit=True)
    return {
        "title": _title(request, params, db),
        "total": total,
        "columns": [{"key": key, "label": COLUMN_LABELS[key]} for key in columns],
        "rows": rows,
        "preview_limit": 100,
        "sort": sort,
        "order": order,
        "html": html,
    }


def _store_report(db: Session, actor: User, title: str, params: dict, columns: list[str], fmt: str, path: str | None) -> Report:
    report = Report(
        title=title,
        excavation_id=params.get("excavation_id"),
        report_type="inventory",
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
    params, columns, headers, rows, total, _sort, _order = _collect(db, request, limit=None)
    title = _title(request, params, db)
    meta = _meta(db, params, total)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    fmt = request.format
    code = "opis"
    if params.get("excavation_id"):
        excavation = db.get(Excavation, params["excavation_id"])
        if excavation:
            code = excavation.code
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", code) or "opis"
    stamp = datetime.now().strftime("%Y%m%d")
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
    params, columns, headers, rows, total, _sort, _order = _collect(db, request, limit=None)
    title = _title(request, params, db)
    generated = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
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
