import math

from app.errors import AppError

NORTH_EAST_LIMIT = 10_000_000
ELEV_MIN = -1000
ELEV_MAX = 10_000
DIMENSION_MAX = 100_000


def require_finite(name: str, value: float | None, low: float, high: float, required: bool = False) -> float | None:
    if value is None:
        if required:
            raise AppError(400, f"Укажите {name}")
        return None
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise AppError(400, f"Некорректное значение {name}")
    return number


def validate_coordinates(north, east, elev, required: bool = False) -> tuple:
    return (
        require_finite("North", north, -NORTH_EAST_LIMIT, NORTH_EAST_LIMIT, required),
        require_finite("East", east, -NORTH_EAST_LIMIT, NORTH_EAST_LIMIT, required),
        require_finite("Elev", elev, ELEV_MIN, ELEV_MAX, required),
    )


def validate_dimension(name: str, value) -> float | None:
    if value is None:
        return None
    number = float(value)
    if not math.isfinite(number) or number < 0 or number > DIMENSION_MAX:
        raise AppError(400, f"Некорректный размер: {name}")
    return number
