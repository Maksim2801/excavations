from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_camera, require_field
from app.database import get_db
from app.models import User
from app.schemas.io import GnssImportIn
from app.services.gnss_service import delete_point, import_points, list_points, preview_csv

router = APIRouter()


@router.get("")
def get_points(excavation_id: int | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_points(db, excavation_id)


@router.post("/preview")
async def preview(
    excavation_id: int = Form(...),
    file: UploadFile = File(...),
    _: User = Depends(require_field),
    db: Session = Depends(get_db),
):
    return preview_csv(db, excavation_id, await file.read())


@router.post("/import")
def import_gnss(data: GnssImportIn, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    return import_points(db, data.excavation_id, data.points, actor, data.source_name)


@router.delete("/{point_id}")
def remove(point_id: int, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    delete_point(db, point_id, actor)
    return {"status": "deleted"}
