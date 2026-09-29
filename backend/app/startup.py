import os
import time

import psycopg
from sqlalchemy.engine.url import make_url

from app.config import settings


def wait_for_database() -> None:
    url = make_url(settings.database_url)
    last_error = None
    for _ in range(30):
        try:
            with psycopg.connect(
                host=url.host or "localhost",
                port=url.port or 5432,
                user=url.username,
                password=url.password,
                dbname=url.database,
                connect_timeout=3,
            ) as connection:
                connection.execute("SELECT 1")
            return
        except Exception as exc:
            last_error = exc
            time.sleep(2)
    raise SystemExit(f"База данных недоступна: {last_error}")


def main() -> None:
    wait_for_database()
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")
    from app.seed import seed

    seed()
    os.execvp("uvicorn", ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"])


if __name__ == "__main__":
    main()
