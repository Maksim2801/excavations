from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_camera, require_supervisor
from app.database import get_db
from app.models import User
from app.schemas.io import ReportIn, TemplateIn
from app.services.report_service import (
    confirm_report,
    delete_template,
    export_report,
    list_reports,
    list_templates,
    preview_report,
    print_report,
    save_template,
)

router = APIRouter()


@router.post("/findings")
def preview(data: ReportIn, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    return preview_report(db, data, actor)


@router.post("/export")
def export(data: ReportIn, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    payload, filename, media, report_id = export_report(db, data, actor)
    return Response(
        content=payload,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Id": str(report_id),
        },
    )


@router.post("/print")
def print_inventory(data: ReportIn, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    return HTMLResponse(print_report(db, data, actor))


@router.get("")
def reports(actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    return list_reports(db)


@router.post("/{report_id}/confirm")
def confirm(report_id: int, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return confirm_report(db, report_id, actor)


@router.get("/templates")
def templates(_: User = Depends(require_camera), db: Session = Depends(get_db)):
    return list_templates(db)


@router.post("/templates")
def create_template(data: TemplateIn, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    return save_template(db, data, actor)


@router.delete("/templates/{template_id}")
def remove_template(template_id: int, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    delete_template(db, template_id, actor)
    return {"status": "deleted"}
