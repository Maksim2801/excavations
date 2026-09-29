from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_supervisor
from app.database import get_db
from app.models import GnssPointType, PhotoType, MeasurementMethodDict, User
from app.schemas.io import DictUpdate, MaterialIn, MaterialUpdate, SchemeUpdate
from app.services.dictionary_service import (
    create_material,
    list_dictionaries,
    update_color_scheme,
    update_material,
    update_named,
)

router = APIRouter()


@router.get("")
def all_dictionaries(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_dictionaries(db)


@router.post("/materials")
def post_material(data: MaterialIn, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return create_material(db, data, actor)


@router.put("/materials/{material_id}")
def put_material(material_id: int, data: MaterialUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_material(db, material_id, data, actor)


@router.put("/color-schemes/{scheme_id}")
def put_scheme(scheme_id: int, data: SchemeUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_color_scheme(db, scheme_id, data, actor)


@router.put("/photo-types/{item_id}")
def put_photo_type(item_id: int, data: DictUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_named(db, PhotoType, item_id, data, actor, "photo_type")


@router.put("/gnss-types/{item_id}")
def put_gnss_type(item_id: int, data: DictUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_named(db, GnssPointType, item_id, data, actor, "gnss_point_type")


@router.put("/measurement-methods/{item_id}")
def put_method(item_id: int, data: DictUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_named(db, MeasurementMethodDict, item_id, data, actor, "measurement_method")
