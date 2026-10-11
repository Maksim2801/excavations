// One contract for inventory, export and reusable report templates.
export const FILTER_KEYS = ["excavation_id", "layer_id", "q", "code", "material", "square", "find_type", "measurement_method", "photo_present", "number_from", "number_to", "elev_from", "elev_to", "date_from", "date_to"];
export const SORT_KEYS = ["code", "number", "north", "east", "elev", "length_mm", "width_mm", "thickness_mm", "square", "layer", "excavation", "material", "measurement_method", "photo_present", "record_status", "created_at", "description", "find_type", "combined"];
export const META = {
  collection_name: "Название коллекции",
  monument: "Название памятника",
  excavation_author: "Автор раскопок",
  source: "Источник поступления",
  dating: "Датировка",
  culture: "Культурная принадлежность",
  place_time: "Время и место нахождения",
  bibliography: "Библиография",
  monument_summary: "Краткие сведения о памятнике",
  report_note: "Примечания к описи",
  inventory_no: "Номер описи",
  inventory_date: "Дата описи",
  approver_role: "Должность утверждающего",
  approver_name: "ФИО утверждающего",
};
export const LAYOUTS = {
  working: "Рабочая опись",
  field: "Полевая опись",
  collection: "Коллекционная опись",
  album: "Альбом иллюстраций",
};
export function cleanReport(data) {
  const result = {};
  for (const key of [...FILTER_KEYS, ...Object.keys(META), "layout", "sort", "order", "title", "columns", "preset", "format", "ids"])
    if (data[key] !== "" && data[key] !== undefined && data[key] !== null) result[key] = data[key];
  if (result.photo_present !== undefined) result.photo_present = result.photo_present === true || result.photo_present === "true";
  if (data.layout !== undefined || result.columns || result.title || result.preset || result.format || Object.keys(META).some((key) => result[key] !== undefined)) {
    if (!result.layout) result.layout = "working";
  }
  return result;
}
export function reportURL(filters, sort, order, ids) {
  const params = new URLSearchParams();
  Object.entries(cleanReport({ ...filters, sort, order })).forEach(([key, value]) => params.set(key, value));
  if (ids?.length) params.set("ids", ids.join(","));
  return `/reports?${params}`;
}
export function reportFromURL(search) {
  const data = Object.fromEntries(search.entries());
  if (data.ids) data.ids = data.ids.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
  return cleanReport(data);
}
export function restoreTemplate(template) {
  return cleanReport({ ...template.filters, ...template.sort, columns: template.columns });
}
