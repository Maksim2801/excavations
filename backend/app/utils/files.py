import uuid
from pathlib import Path

from app.config import settings
from app.errors import AppError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
    "application/octet-stream",
}


def ensure_dir(path: str | Path) -> Path:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    return target


def upload_root() -> Path:
    return ensure_dir(settings.upload_dir)


def report_root() -> Path:
    return ensure_dir(settings.report_dir)


def safe_original_name(filename: str | None) -> str:
    name = Path(filename or "photo").name
    if not name or name in {".", ".."}:
        raise AppError(400, "Некорректное имя файла")
    return name


def extension_of(filename: str) -> str:
    return Path(filename).suffix.lower()


def generate_filename(original_name: str) -> str:
    ext = extension_of(original_name)
    if ext not in ALLOWED_EXTENSIONS:
        raise AppError(400, "Допустимы изображения JPG, PNG, WEBP и TIFF")
    return f"{uuid.uuid4().hex}{ext}"


def resolve_storage_path(relative_path: str) -> Path:
    if not relative_path or relative_path.startswith(("/", "\\")) or ".." in Path(relative_path).parts:
        raise AppError(400, "Недопустимый путь к файлу")
    root = upload_root().resolve()
    target = (root / relative_path).resolve()
    if root != target and root not in target.parents:
        raise AppError(400, "Недопустимый путь к файлу")
    return target
