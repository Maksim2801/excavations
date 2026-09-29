from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class LoginIn(BaseModel):
    username: str
    password: str


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=255)
    email: str | None = None

    @field_validator("username")
    @classmethod
    def username_chars(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned.replace(".", "").replace("_", "").replace("-", "").isalnum():
            raise ValueError("Имя пользователя может содержать буквы, цифры, точку, _ и -")
        return cleaned

    @field_validator("email")
    @classmethod
    def email_ok(cls, value: str | None) -> str | None:
        if value and "@" not in value:
            raise ValueError("Укажите корректную почту")
        return value


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


class ExcavationIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    year: int = Field(ge=1900, le=2100)
    center_north: float
    center_east: float
    center_elev: float
    description: str | None = None
    area_m2: float | None = Field(default=None, ge=0)
    grid_step_m: float | None = Field(default=5, gt=0)
    boundaries: str | None = None


class ExcavationUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    year: int | None = Field(default=None, ge=1900, le=2100)
    center_north: float | None = None
    center_east: float | None = None
    center_elev: float | None = None
    description: str | None = None
    area_m2: float | None = Field(default=None, ge=0)
    grid_step_m: float | None = Field(default=None, gt=0)
    boundaries: str | None = None
    status: str | None = None


class LayerIn(BaseModel):
    excavation_id: int
    number: int = Field(ge=1)
    top_elev: float
    bottom_elev: float
    description: str | None = None
    color: str | None = None
    status: str | None = "open"
    surface_description: str | None = None
    inclusions: str | None = None
    interpretation: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def elev_order(self):
        if self.top_elev < self.bottom_elev:
            raise ValueError("Верхняя отметка пласта не может быть ниже нижней")
        return self


class LayerUpdate(BaseModel):
    number: int | None = Field(default=None, ge=1)
    top_elev: float | None = None
    bottom_elev: float | None = None
    description: str | None = None
    color: str | None = None
    status: str | None = None
    surface_description: str | None = None
    inclusions: str | None = None
    interpretation: str | None = None
    note: str | None = None


class FindingIn(BaseModel):
    excavation_id: int
    layer_id: int | None = None
    pt: int | None = None
    code: str = Field(min_length=1, max_length=100)
    number: int = Field(ge=1)
    north: float | None = None
    east: float | None = None
    elev: float | None = None
    square: str | None = None
    description: str | None = None
    material: str | None = None
    find_type: str | None = None
    quantity: int | None = Field(default=1, ge=1)
    vessel_part: str | None = None
    ornament: str | None = None
    surface_color: str | None = None
    fracture_color: str | None = None
    fabric: str | None = None
    temper: str | None = None
    surface_treatment: str | None = None
    note: str | None = None
    depth_cm: float | None = Field(default=None, ge=0)
    length_mm: float | None = Field(default=None, ge=0)
    width_mm: float | None = Field(default=None, ge=0)
    thickness_mm: float | None = Field(default=None, ge=0)


class FindingUpdate(BaseModel):
    excavation_id: int | None = None
    layer_id: int | None = None
    pt: int | None = None
    code: str | None = Field(default=None, min_length=1, max_length=100)
    number: int | None = Field(default=None, ge=1)
    north: float | None = None
    east: float | None = None
    elev: float | None = None
    square: str | None = None
    description: str | None = None
    material: str | None = None
    find_type: str | None = None
    quantity: int | None = Field(default=None, ge=1)
    vessel_part: str | None = None
    ornament: str | None = None
    surface_color: str | None = None
    fracture_color: str | None = None
    fabric: str | None = None
    temper: str | None = None
    surface_treatment: str | None = None
    note: str | None = None
    depth_cm: float | None = Field(default=None, ge=0)
    length_mm: float | None = Field(default=None, ge=0)
    width_mm: float | None = Field(default=None, ge=0)
    thickness_mm: float | None = Field(default=None, ge=0)
    measurement_method: str | None = None


class CoordinatesIn(BaseModel):
    north: float
    east: float
    elev: float


class DimensionsIn(BaseModel):
    length_mm: float | None = Field(default=None, ge=0)
    width_mm: float | None = Field(default=None, ge=0)
    thickness_mm: float | None = Field(default=None, ge=0)
    measurement_method: str | None = None


class PointIn(BaseModel):
    x: float
    y: float


class MeasureIn(BaseModel):
    photo_id: int
    measurement_type: Literal["length", "width", "thickness"]
    scale_mm: float = Field(gt=0)
    scale_points: list[PointIn] | None = None
    object_points: list[PointIn]
    accept: bool = False

    @model_validator(mode="after")
    def points_count(self):
        if len(self.object_points) != 2:
            raise ValueError("Нужны две точки измеряемого участка")
        if self.scale_points is not None and len(self.scale_points) != 2:
            raise ValueError("Нужны две точки масштаба")
        return self


class GnssPointIn(BaseModel):
    north: float | None = None
    east: float | None = None
    elev: float | None = None
    point_type: str | None = None
    comment: str | None = None


class GnssImportIn(BaseModel):
    excavation_id: int
    source_name: str | None = None
    points: list[GnssPointIn]


class ReportIn(BaseModel):
    excavation_id: int | None = None
    layer_id: int | None = None
    code: str | None = None
    material: str | None = None
    square: str | None = None
    find_type: str | None = None
    measurement_method: str | None = None
    number_from: int | None = None
    number_to: int | None = None
    elev_from: float | None = None
    elev_to: float | None = None
    columns: list[str] | None = None
    preset: Literal["minimal", "extended"] | None = None
    sort: str = "number"
    order: Literal["asc", "desc"] = "asc"
    title: str | None = None
    format: Literal["xlsx", "pdf"] | None = None


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    filters: dict = Field(default_factory=dict)
    columns: list[str] = Field(default_factory=list)
    sort: dict = Field(default_factory=dict)


class MaterialIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = None
    color: str | None = "#5c6b73"


class MaterialUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    color: str | None = None
    is_active: bool | None = None


class SchemeUpdate(BaseModel):
    name: str | None = None
    mode: str | None = None
    mapping: dict | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class DictUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
