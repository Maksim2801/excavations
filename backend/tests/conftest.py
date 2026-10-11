import os
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://archaeology:archaeology@localhost:5432/archaeology_test",
)
os.environ["JWT_SECRET"] = "test-secret"
os.environ["FRONTEND_DIR"] = str(ROOT / "frontend")
os.environ["UPLOAD_DIR"] = str(BACKEND / "uploads" / "test")
os.environ["REPORT_DIR"] = str(BACKEND / "reports" / "test")
os.chdir(BACKEND)

import psycopg
import pytest
from sqlalchemy import text
from sqlalchemy.engine.url import make_url

PASSWORD = "Testpass1"


def _admin_connect():
    url = make_url(os.environ["DATABASE_URL"])
    return psycopg.connect(
        host=url.host or "localhost",
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        dbname="postgres",
        autocommit=True,
        connect_timeout=4,
    ), url


def postgres_up() -> bool:
    try:
        connection, _url = _admin_connect()
    except Exception:
        return False
    connection.close()
    return True


@pytest.fixture(scope="session")
def database():
    if not postgres_up():
        if os.environ.get("REQUIRE_POSTGIS_TESTS") == "1":
            pytest.fail("PostgreSQL/PostGIS обязателен для этого прогона")
        pytest.skip("PostgreSQL/PostGIS недоступен")
    connection, url = _admin_connect()
    exists = connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)).fetchone()
    if not exists:
        connection.execute(f'CREATE DATABASE "{url.database}"')
    connection.close()
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")
    yield


def _ensure_reference(session):
    from app.constants import GNSS_TYPE_ROWS, MATERIALS, MEASUREMENT_METHOD_ROWS, PHOTO_TYPE_ROWS
    from app.models import GnssPointType, Material, MeasurementMethodDict, PhotoType, PlanColorScheme

    if session.query(Material).count():
        return
    for row in MATERIALS:
        session.add(Material(name=row["name"], code=row["code"], color=row["color"], is_active=True))
    for row in GNSS_TYPE_ROWS:
        session.add(GnssPointType(code=row["code"], name=row["name"], is_active=True))
    for row in PHOTO_TYPE_ROWS:
        session.add(PhotoType(code=row["code"], name=row["name"], is_active=True))
    for row in MEASUREMENT_METHOD_ROWS:
        session.add(MeasurementMethodDict(code=row["code"], name=row["name"], is_active=True))
    session.add(PlanColorScheme(name="По материалу", mode="material", mapping_json="{}", is_default=True, is_active=True))
    session.add(PlanColorScheme(name="По пластам", mode="layer", mapping_json='{"palette":["#8c3a2f","#2f6b4f"]}', is_default=False, is_active=True))
    session.commit()


def reset_db():
    import app.models  # noqa: F401
    from app.database import Base, SessionLocal

    session = SessionLocal()
    names = ", ".join(f'"{table.name}"' for table in reversed(Base.metadata.sorted_tables))
    session.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
    session.commit()
    _ensure_reference(session)
    session.close()


@pytest.fixture()
def client(database):
    reset_db()
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def accounts(client):
    from app.database import SessionLocal
    from app.services.user_service import create_user_record

    db = SessionLocal()
    for username, role, full_name in (
        ("sup", "supervisor", "Руководитель"),
        ("cam", "camera_staff", "Камеральный"),
        ("fld", "field_archaeologist", "Полевой"),
    ):
        create_user_record(db, username=username, password=PASSWORD, full_name=full_name, role=role)
    db.close()

    def headers(username):
        response = client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return {"supervisor": headers("sup"), "camera": headers("cam"), "field": headers("fld")}
