export const ROLE_RANK = {
  field_archaeologist: 1,
  camera_staff: 2,
  supervisor: 3,
};

export const ROLE_LABELS = {
  field_archaeologist: "Полевой археолог",
  camera_staff: "Камеральный сотрудник",
  supervisor: "Руководитель работ",
};

export const METHOD_LABELS = {
  none: "не указан",
  photo: "по фото",
  manual: "ручное",
};

export const LAYER_STATUS = {
  open: "открыт",
  recorded: "зафиксирован",
  closed: "закрыт",
};

export const GNSS_LABELS = {
  corner: "Угловая",
  control: "Контрольная",
  auxiliary: "Вспомогательная",
};

export const ISSUE_LABELS = {
  no_coordinates: "нет координат",
  no_dimensions: "нет размеров",
  no_photo: "нет фото",
  no_layer: "нет пласта",
  incomplete: "черновик",
};

export const COLUMN_LABELS = {
  code: "Код",
  number: "Номер",
  excavation: "Раскоп",
  layer: "Пласт",
  square: "Квадрат",
  material: "Материал",
  north: "North",
  east: "East",
  elev: "Elev",
  length_mm: "Длина, мм",
  width_mm: "Ширина, мм",
  thickness_mm: "Толщина, мм",
  description: "Описание",
  find_type: "Тип находки",
  quantity: "Количество",
  measurement_method: "Способ измерения",
  photo_present: "Фото",
  vessel_part: "Часть сосуда",
  ornament: "Орнамент",
  surface_color: "Цвет поверхности",
  note: "Примечание",
  pt: "Pt",
  depth_cm: "Глубина, см",
};

export const MINIMAL_COLUMNS = [
  "code", "number", "excavation", "layer", "square", "material",
  "north", "east", "elev", "length_mm", "width_mm", "thickness_mm",
];

export const EXTENDED_COLUMNS = MINIMAL_COLUMNS.concat([
  "description", "find_type", "quantity", "measurement_method", "photo_present",
  "vessel_part", "ornament", "surface_color", "note", "pt", "depth_cm",
]);

export const MATERIAL_COLORS = {
  "керамика": "#2f6b4f",
  "металл": "#a16207",
  "кость": "#c4a574",
  "камень": "#5c6b73",
  "стекло": "#3d7ea6",
  "кремень": "#6b5b4b",
  "дерево": "#7a5a3a",
  "глина": "#8d5a4a",
};

export const LAYER_PALETTE = ["#8c3a2f", "#2f6b4f", "#3d7ea6", "#a16207", "#6b4c7a", "#4f6b4a", "#8a5a44", "#3f5f73"];

export function rank(user) {
  return ROLE_RANK[user?.role] || 0;
}

export function allow(user, level) {
  return rank(user) >= level;
}

export function issueText(issues) {
  return (issues || []).map((item) => ISSUE_LABELS[item] || item).join(", ");
}

export function fmt(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return number.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}
