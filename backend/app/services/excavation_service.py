import math

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.constants import EXCAVATION_ACTIVE, EXCAVATION_ARCHIVED
from app.errors import AppError
from app.models import Excavation, Finding, GNSSPoint, Layer, Photo, User
from app.services.audit_service import write_audit
from app.services.domain import get_excavation, touch
from app.utils.geometry import point_element
from app.utils.validators import validate_coordinates


def _counts(db: Session, excavation_id: int) -> dict:
    return {
        "layer_count": db.query(func.count(Layer.id)).filter(Layer.excavation_id == excavation_id).scalar() or 0,
        "finding_count": db.query(func.count(Finding.id)).filter(Finding.excavation_id == excavation_id).scalar() or 0,
        "gnss_count": db.query(func.count(GNSSPoint.id)).filter(GNSSPoint.excavation_id == excavation_id).scalar() or 0,
        "photo_count": db.query(func.count(Photo.id)).filter(Photo.excavation_id == excavation_id).scalar() or 0,
    }


def excavation_dict(db: Session, excavation: Excavation) -> dict:
    data = {
        "id": excavation.id,
        "code": excavation.code,
        "year": excavation.year,
        "center_north": excavation.center_north,
        "center_east": excavation.center_east,
        "center_elev": excavation.center_elev,
        "description": excavation.description,
        "status": excavation.status,
        "area_m2": excavation.area_m2,
        "grid_step_m": excavation.grid_step_m,
        "boundaries": excavation.boundaries,
        "created_at": excavation.created_at,
        "updated_at": excavation.updated_at,
    }
    data.update(_counts(db, excavation.id))
    return data


def list_excavations(db: Session, status: str | None = None) -> list[dict]:
    query = db.query(Excavation).order_by(Excavation.year.desc(), Excavation.code.asc())
    if status:
        query = query.filter(Excavation.status == status)
    return [excavation_dict(db, item) for item in query.all()]


def create_excavation(db: Session, data, actor: User) -> dict:
    north, east, elev = validate_coordinates(data.center_north, data.center_east, data.center_elev, required=True)
    exists = (
        db.query(Excavation)
        .filter(Excavation.code == data.code.strip(), Excavation.year == data.year)
        .first()
    )
    if exists:
        raise AppError(409, "Раскоп с таким кодом и годом уже существует")
    excavation = Excavation(
        code=data.code.strip(),
        year=data.year,
        center_north=north,
        center_east=east,
        center_elev=elev,
        description=data.description,
        status=EXCAVATION_ACTIVE,
        area_m2=data.area_m2,
        grid_step_m=data.grid_step_m if data.grid_step_m is not None else 5,
        boundaries=data.boundaries,
        created_by_id=actor.id,
        geom=point_element(east, north, elev),
    )
    db.add(excavation)
    db.flush()
    write_audit(db, user_id=actor.id, action="create", entity="excavation", entity_id=excavation.id, details=excavation.code)
    db.commit()
    db.refresh(excavation)
    return excavation_dict(db, excavation)


def update_excavation(db: Session, excavation_id: int, data, actor: User) -> dict:
    excavation = get_excavation(db, excavation_id)
    payload = data.model_dump(exclude_unset=True)
    code = payload.get("code", excavation.code).strip()
    year = payload.get("year", excavation.year)
    duplicate = (
        db.query(Excavation)
        .filter(Excavation.code == code, Excavation.year == year, Excavation.id != excavation.id)
        .first()
    )
    if duplicate:
        raise AppError(409, "Раскоп с таким кодом и годом уже существует")
    north = payload.get("center_north", excavation.center_north)
    east = payload.get("center_east", excavation.center_east)
    elev = payload.get("center_elev", excavation.center_elev)
    north, east, elev = validate_coordinates(north, east, elev, required=True)
    excavation.code = code
    excavation.year = year
    excavation.center_north = north
    excavation.center_east = east
    excavation.center_elev = elev
    excavation.geom = point_element(east, north, elev)
    for field in ("description", "area_m2", "grid_step_m", "boundaries"):
        if field in payload:
            setattr(excavation, field, payload[field])
    if "status" in payload and payload["status"] is not None:
        if payload["status"] not in {EXCAVATION_ACTIVE, EXCAVATION_ARCHIVED}:
            raise AppError(400, "Статус раскопа должен быть active или archived")
        excavation.status = payload["status"]
    touch(excavation)
    write_audit(db, user_id=actor.id, action="update", entity="excavation", entity_id=excavation.id, details=excavation.code)
    db.commit()
    db.refresh(excavation)
    return excavation_dict(db, excavation)


def archive_excavation(db: Session, excavation_id: int, actor: User) -> dict:
    excavation = get_excavation(db, excavation_id)
    excavation.status = EXCAVATION_ARCHIVED
    touch(excavation)
    write_audit(db, user_id=actor.id, action="archive", entity="excavation", entity_id=excavation.id, details=excavation.code)
    db.commit()
    db.refresh(excavation)
    return excavation_dict(db, excavation)


def restore_excavation(db: Session, excavation_id: int, actor: User) -> dict:
    excavation = get_excavation(db, excavation_id)
    excavation.status = EXCAVATION_ACTIVE
    touch(excavation)
    write_audit(db, user_id=actor.id, action="restore", entity="excavation", entity_id=excavation.id, details=excavation.code)
    db.commit()
    db.refresh(excavation)
    return excavation_dict(db, excavation)


def delete_excavation(db: Session, excavation_id: int, actor: User) -> None:
    excavation = get_excavation(db, excavation_id)
    if excavation.status == EXCAVATION_ARCHIVED:
        raise AppError(409, "Архивный раскоп нельзя удалить")
    counts = _counts(db, excavation.id)
    if counts["layer_count"] or counts["finding_count"] or counts["gnss_count"] or counts["photo_count"]:
        raise AppError(
            409,
            "Нельзя удалить раскоп: к нему привязаны "
            f"пласты ({counts['layer_count']}), находки ({counts['finding_count']}), "
            f"GNSS-точки ({counts['gnss_count']}), фотографии ({counts['photo_count']}).",
        )
    write_audit(db, user_id=actor.id, action="delete", entity="excavation", entity_id=excavation.id, details=excavation.code)
    db.delete(excavation)
    db.commit()


def _corner_polygon(points: list[GNSSPoint]) -> str | None:
    corners = [point for point in points if point.point_type == "corner"]
    if len(corners) < 3:
        return None
    cx = sum(point.east for point in corners) / len(corners)
    cy = sum(point.north for point in corners) / len(corners)
    ordered = sorted(corners, key=lambda point: math.atan2(point.north - cy, point.east - cx))
    ring = [f"{point.east:.4f} {point.north:.4f}" for point in ordered]
    ring.append(ring[0])
    return f"POLYGON(({', '.join(ring)}))"


def excavation_checks(db: Session, excavation_id: int) -> dict:
    excavation = get_excavation(db, excavation_id)
    findings = db.query(Finding).filter(Finding.excavation_id == excavation.id).all()
    missing_coordinates = [item.id for item in findings if item.north is None or item.east is None or item.elev is None]
    missing_dimensions = [
        item.id for item in findings if item.length_mm is None or item.width_mm is None or item.thickness_mm is None
    ]
    missing_photos = [item.id for item in findings if not item.photo_present]
    missing_layers = [item.id for item in findings if item.layer_id is None]
    elev_outside_layer = []
    for item in findings:
        if item.layer_id is None or item.elev is None:
            continue
        layer = item.layer or db.get(Layer, item.layer_id)
        if layer and (item.elev > layer.top_elev or item.elev < layer.bottom_elev):
            elev_outside_layer.append(item.id)
    outside_contour = []
    points = db.query(GNSSPoint).filter(GNSSPoint.excavation_id == excavation.id).all()
    polygon = _corner_polygon(points)
    if polygon:
        rows = db.execute(
            text(
                """
                SELECT id FROM findings
                WHERE excavation_id = :eid
                  AND geom IS NOT NULL
                  AND NOT ST_Covers(ST_GeomFromText(:poly, 0), ST_Force2D(geom))
                """
            ),
            {"eid": excavation.id, "poly": polygon},
        ).fetchall()
        outside_contour = [row[0] for row in rows]
    return {
        "excavation_id": excavation.id,
        "missing_coordinates": missing_coordinates,
        "missing_dimensions": missing_dimensions,
        "missing_photos": missing_photos,
        "missing_layers": missing_layers,
        "elev_outside_layer": elev_outside_layer,
        "outside_contour": outside_contour,
    }
