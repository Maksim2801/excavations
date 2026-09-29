from fastapi import APIRouter

from app.api import auth, dictionaries, excavations, findings, gnss, layers, photos, plan, reports, system, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Авторизация"])
api_router.include_router(users.router, prefix="/users", tags=["Пользователи"])
api_router.include_router(excavations.router, prefix="/excavations", tags=["Раскопы"])
api_router.include_router(layers.router, prefix="/layers", tags=["Пласты"])
api_router.include_router(findings.router, prefix="/findings", tags=["Находки"])
api_router.include_router(photos.router, prefix="/photos", tags=["Фотографии"])
api_router.include_router(gnss.router, prefix="/gnss", tags=["GNSS"])
api_router.include_router(plan.router, prefix="/plan", tags=["План"])
api_router.include_router(reports.router, prefix="/reports", tags=["Отчёты"])
api_router.include_router(dictionaries.router, prefix="/dictionaries", tags=["Справочники"])
api_router.include_router(system.router, tags=["Система"])
