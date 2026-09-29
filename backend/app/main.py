import logging
from pathlib import Path

from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import settings
from app.errors import AppError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("archaeology")

app = FastAPI(
    title="Полевые описи археологических находок",
    description="Учёт раскопов, пластов и находок, план, фотоанализ, GNSS и полевые описи.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")


@app.middleware("http")
async def frontend_cache(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".js", ".css", ".html")):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    logger.info("app error %s %s", request.url.path, exc.detail)
    return JSONResponse(status_code=exc.status, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors():
        location = ".".join(str(item) for item in error.get("loc", []) if item not in {"body", "query"})
        message = error.get("msg", "Проверьте введённые данные")
        messages.append(f"{location}: {message}" if location else message)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages) or "Проверьте введённые данные"})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logger.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера. Повторите попытку."})


def _frontend() -> Path:
    return Path(settings.frontend_dir).resolve()


@app.get("/", include_in_schema=False)
def index():
    page = _frontend() / "index.html"
    if not page.exists():
        return JSONResponse({"detail": "Интерфейс не найден"}, status_code=404)
    return FileResponse(page)


@app.get("/styles.css", include_in_schema=False)
def styles():
    return FileResponse(_frontend() / "styles.css")


@app.get("/app.js", include_in_schema=False)
def application_script():
    return FileResponse(_frontend() / "app.js")


def _mount_frontend() -> None:
    modules = _frontend() / "modules"
    if modules.exists():
        app.mount("/modules", StaticFiles(directory=modules), name="modules")


_mount_frontend()
