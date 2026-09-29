from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_field
from app.database import get_db
from app.models import User
from app.services.photo_service import (
    analyze_photo,
    delete_photo,
    detect_photo_scale,
    list_photos,
    photo_file,
    save_photo,
)

router = APIRouter()


@router.get("")
def get_photos(
    finding_id: int | None = None,
    layer_id: int | None = None,
    excavation_id: int | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_photos(db, finding_id, layer_id, excavation_id)


@router.post("")
async def post_photo(
    file: UploadFile = File(...),
    finding_id: int | None = Form(None),
    layer_id: int | None = Form(None),
    excavation_id: int | None = Form(None),
    photo_type: str = Form("finding"),
    author: str | None = Form(None),
    shot_date: str | None = Form(None),
    has_scale: bool = Form(False),
    actor: User = Depends(require_field),
    db: Session = Depends(get_db),
):
    return await save_photo(
        db,
        file,
        actor,
        finding_id=finding_id,
        layer_id=layer_id,
        excavation_id=excavation_id,
        photo_type=photo_type,
        author=author,
        shot_date=shot_date,
        has_scale=has_scale,
    )


@router.get("/{photo_id}")
def get_one(photo_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.photo_service import get_photo, photo_dict

    return photo_dict(get_photo(db, photo_id))


@router.get("/{photo_id}/file")
def download(photo_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    path, media = photo_file(db, photo_id, thumb=False)
    return FileResponse(path, media_type=media)


@router.get("/{photo_id}/thumb")
def thumb(photo_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    path, media = photo_file(db, photo_id, thumb=True)
    return FileResponse(path, media_type=media)


@router.post("/{photo_id}/analyze")
def analyze(photo_id: int, scale_mm: float = 100, _: User = Depends(require_field), db: Session = Depends(get_db)):
    return analyze_photo(db, photo_id, scale_mm)


@router.post("/{photo_id}/detect-scale")
def detect(photo_id: int, _: User = Depends(require_field), db: Session = Depends(get_db)):
    return detect_photo_scale(db, photo_id)


@router.delete("/{photo_id}")
def remove(photo_id: int, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    delete_photo(db, photo_id, actor)
    return {"status": "deleted"}
