import io
import logging
from datetime import date, datetime
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import PHOTO_TYPES
from app.errors import AppError
from app.models import Photo, User
from app.services.audit_service import write_audit
from app.services.domain import bind_layer, ensure_writable, get_excavation, get_finding, refresh_record_status
from app.services.photo_analysis import analyze_photo_file, detect_scale_marker
from app.utils.files import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME,
    extension_of,
    generate_filename,
    resolve_storage_path,
    safe_original_name,
    upload_root,
)

logger = logging.getLogger("archaeology.photo")


def photo_dict(photo: Photo) -> dict:
    return {
        "id": photo.id,
        "finding_id": photo.finding_id,
        "layer_id": photo.layer_id,
        "excavation_id": photo.excavation_id,
        "original_name": photo.original_name,
        "photo_type": photo.photo_type,
        "author": photo.author,
        "shot_date": photo.shot_date,
        "has_scale": photo.has_scale,
        "mime_type": photo.mime_type,
        "size_bytes": photo.size_bytes,
        "created_at": photo.created_at,
    }


def list_photos(
    db: Session,
    finding_id: int | None = None,
    layer_id: int | None = None,
    excavation_id: int | None = None,
) -> list[dict]:
    query = db.query(Photo).order_by(Photo.photo_type.asc(), Photo.created_at.asc(), Photo.id.asc())
    if finding_id:
        query = query.filter(Photo.finding_id == finding_id)
    if layer_id:
        query = query.filter(Photo.layer_id == layer_id)
    if excavation_id:
        query = query.filter(Photo.excavation_id == excavation_id)
    return [photo_dict(photo) for photo in query.all()]


def get_photo(db: Session, photo_id: int) -> Photo:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise AppError(404, "Фотография не найдена")
    return photo


def _refresh_finding_photo_flag(db: Session, finding_id: int | None) -> None:
    if not finding_id:
        return
    finding = get_finding(db, finding_id)
    finding.photo_present = db.query(Photo).filter(Photo.finding_id == finding.id).count() > 0
    refresh_record_status(finding)


async def save_photo(
    db: Session,
    file: UploadFile,
    actor: User,
    *,
    finding_id: int | None,
    layer_id: int | None,
    excavation_id: int | None,
    photo_type: str,
    author: str | None,
    shot_date: str | None,
    has_scale: bool,
) -> dict:
    if not any((finding_id, layer_id, excavation_id)):
        raise AppError(400, "Укажите находку, пласт или раскоп для фотографии")
    if photo_type not in PHOTO_TYPES:
        raise AppError(400, "Неизвестный тип фотографии")
    original = safe_original_name(file.filename)
    if extension_of(original) not in ALLOWED_EXTENSIONS:
        raise AppError(400, "Допустимы изображения JPG, PNG, WEBP и TIFF")
    mime = (file.content_type or "").split(";")[0].strip().lower()
    if mime and mime not in ALLOWED_MIME:
        raise AppError(400, "Недопустимый тип файла")
    data = await file.read()
    if not data:
        raise AppError(400, "Файл пуст")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(400, f"Размер файла превышает {settings.max_upload_mb} МБ")
    try:
        Image.open(io.BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError):
        raise AppError(400, "Файл не является изображением")

    finding = None
    layer = None
    excavation = None
    if finding_id:
        finding = get_finding(db, finding_id)
        excavation = get_excavation(db, finding.excavation_id)
        if excavation_id and excavation_id != excavation.id:
            raise AppError(400, "Фотография находки не соответствует выбранному раскопу")
        if layer_id and finding.layer_id and layer_id != finding.layer_id:
            raise AppError(400, "Фотография находки не соответствует выбранному пласту")
        excavation_id = excavation.id
        layer_id = layer_id or finding.layer_id
    if layer_id:
        layer = bind_layer(db, excavation_id or 0, layer_id) if excavation_id else None
        if layer is None:
            from app.services.domain import get_layer

            layer = get_layer(db, layer_id)
        excavation_id = layer.excavation_id
        excavation = get_excavation(db, excavation_id)
    if excavation is None and excavation_id:
        excavation = get_excavation(db, excavation_id)
    if excavation is None:
        raise AppError(400, "Не найдена связанная сущность для фотографии")
    ensure_writable(excavation)

    parsed_date = None
    if shot_date:
        try:
            parsed_date = date.fromisoformat(shot_date)
        except ValueError:
            raise AppError(400, "Дата съёмки должна быть в формате ГГГГ-ММ-ДД")

    stored_name = generate_filename(original)
    root = upload_root()
    target = root / stored_name
    target.write_bytes(data)
    thumb_name = f"thumb_{Path(stored_name).stem}.jpg"
    try:
        image = Image.open(io.BytesIO(data))
        image.thumbnail((480, 480))
        image.convert("RGB").save(root / thumb_name, "JPEG", quality=80)
    except OSError:
        thumb_name = None
        logger.exception("thumbnail failed for %s", original)

    photo = Photo(
        finding_id=finding.id if finding else None,
        layer_id=layer_id,
        excavation_id=excavation.id,
        file_path=stored_name,
        thumb_path=thumb_name,
        original_name=original,
        photo_type=photo_type,
        author=(author or actor.full_name or "").strip() or None,
        shot_date=parsed_date,
        has_scale=has_scale,
        mime_type=mime or "application/octet-stream",
        size_bytes=len(data),
        uploaded_by_id=actor.id,
    )
    db.add(photo)
    db.flush()
    _refresh_finding_photo_flag(db, photo.finding_id)
    write_audit(
        db,
        user_id=actor.id,
        action="upload_photo",
        entity="photo",
        entity_id=photo.id,
        details=original,
    )
    db.commit()
    db.refresh(photo)
    logger.info("photo uploaded id=%s bytes=%s", photo.id, len(data))
    return photo_dict(photo)


def delete_photo(db: Session, photo_id: int, actor: User) -> None:
    photo = get_photo(db, photo_id)
    if photo.excavation_id:
        ensure_writable(get_excavation(db, photo.excavation_id))
    finding_id = photo.finding_id
    for relative in (photo.file_path, photo.thumb_path):
        if not relative:
            continue
        path = resolve_storage_path(relative)
        if path.exists():
            path.unlink()
    write_audit(db, user_id=actor.id, action="delete", entity="photo", entity_id=photo.id, details=photo.original_name)
    db.delete(photo)
    db.flush()
    _refresh_finding_photo_flag(db, finding_id)
    db.commit()


def photo_file(db: Session, photo_id: int, thumb: bool = False) -> tuple[Path, str]:
    photo = get_photo(db, photo_id)
    relative = photo.thumb_path if thumb and photo.thumb_path else photo.file_path
    path = resolve_storage_path(relative)
    if not path.exists():
        raise AppError(404, "Файл фотографии отсутствует на диске")
    media = "image/jpeg" if thumb else (photo.mime_type or "application/octet-stream")
    return path, media


def analyze_photo(db: Session, photo_id: int, scale_mm: float) -> dict:
    if scale_mm <= 0:
        raise AppError(400, "Длина масштабного маркера должна быть больше нуля")
    photo = get_photo(db, photo_id)
    path = resolve_storage_path(photo.file_path)
    if not path.exists():
        raise AppError(404, "Файл фотографии отсутствует на диске")
    result = analyze_photo_file(str(path), scale_mm)
    result["photo_id"] = photo.id
    return result


def detect_photo_scale(db: Session, photo_id: int) -> dict:
    photo = get_photo(db, photo_id)
    path = resolve_storage_path(photo.file_path)
    if not path.exists():
        raise AppError(404, "Файл фотографии отсутствует на диске")
    detected = detect_scale_marker(str(path))
    detected["photo_id"] = photo.id
    detected["has_scale"] = photo.has_scale
    return detected
