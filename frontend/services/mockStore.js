import {
  COLUMN_LABELS,
  EXTENDED_COLUMNS,
  GNSS_LABELS,
  LAYER_PALETTE,
  MATERIAL_COLORS,
  METHOD_LABELS,
  MINIMAL_COLUMNS,
  ROLE_LABELS,
  allow,
} from "../modules/labels.js";

const STORAGE_KEY = "arch-mock-v1";

const FINDING_SEED = [
  { ex: 1, layer: 1, code: "R1", number: 1, north: 1008, east: 2006, elev: 150.31, square: "А1", material: "керамика", find_type: "фрагмент сосуда", description: "Венчик лепного сосуда", vessel_part: "венчик", ornament: "насечки по краю", length_mm: 75, width_mm: 35, thickness_mm: 9, photo: true, method: "photo" },
  { ex: 1, layer: 1, code: "R1", number: 2, north: 1012, east: 2008, elev: 150.28, square: "А1", material: "кость", find_type: "изделие", description: "Костяное остриё", length_mm: 64, width_mm: 12, thickness_mm: 8, photo: true },
  { ex: 1, layer: 1, code: "R1", number: 3, north: 1016, east: 2014, elev: 150.25, square: "А2", material: "кремень", find_type: "отщеп", description: "Кремнёвый отщеп", length_mm: 28, width_mm: 18, thickness_mm: 5 },
  { ex: 1, layer: 2, code: "R1", number: 4, north: 1004, east: 2012, elev: 150.1, square: "Б1", material: "металл", find_type: "нож", description: "Обломок железного ножа", length_mm: 92, width_mm: 18, thickness_mm: 4, photo: true },
  { ex: 1, layer: 2, code: "R1", number: 5, north: 1006, east: 2016, elev: 150.05, square: "Б1", material: "керамика", find_type: "фрагмент сосуда", description: "Стенка с расчёсами", surface_treatment: "расчёсы", length_mm: 55, width_mm: 40, thickness_mm: 7 },
  { ex: 1, layer: 2, code: "R1", number: 6, north: 1014, east: 2004, elev: 150.08, square: "Б2", material: "стекло", find_type: "бусина", description: "Синяя стеклянная бусина", length_mm: 8, width_mm: 8, thickness_mm: 8 },
  { ex: 1, layer: 3, code: "R1", number: 7, north: 1002, east: 2002, elev: 149.9, square: "В1", material: "камень", find_type: "грузило", description: "Каменное грузило с отверстием" },
  { ex: 1, layer: 3, code: "R1", number: 8, north: 1018, east: 2018, elev: 149.86, square: "В2", material: "глина", find_type: "обмазка", description: "Фрагмент обмазки", length_mm: 40, width_mm: 30, thickness_mm: 15, photo: true },
  { ex: 1, layer: 1, code: "R1", number: 9, square: "А2", material: "керамика", find_type: "фрагмент сосуда", description: "Стенка без координат", length_mm: 33, width_mm: 21, thickness_mm: 6 },
  { ex: 1, layer: null, code: "R1", number: 10, north: 1010, east: 2010, elev: 150.15, square: "А1", material: "кость", find_type: "фрагмент", description: "Кость без привязки к пласту" },
  { ex: 1, layer: 2, code: "R1", number: 11, north: 1100, east: 2005, elev: 150.02, square: "Г1", material: "металл", find_type: "шлак", description: "Шлак вне контура раскопа", length_mm: 22, width_mm: 16, thickness_mm: 10 },
  { ex: 1, layer: 1, code: "R1", number: 12, north: 1009, east: 2011, elev: 150.33, square: "А1", material: "дерево", find_type: "уголь", description: "Фрагмент обугленного дерева" },
  { ex: 2, layer: 1, code: "S2", number: 1, north: 502, east: 798, elev: 120.12, square: "1", material: "керамика", find_type: "фрагмент сосуда", description: "Край миски", length_mm: 48, width_mm: 36, thickness_mm: 6 },
  { ex: 2, layer: 1, code: "S2", number: 2, north: 506, east: 804, elev: 120.08, square: "1", material: "кремень", find_type: "пластина", description: "Кремнёвая пластина", length_mm: 31, width_mm: 11, thickness_mm: 3 },
  { ex: 2, layer: 2, code: "S2", number: 3, north: 496, east: 802, elev: 119.92, square: "2", material: "кость", find_type: "астрагал", description: "Астрагал со следами обработки", length_mm: 29, width_mm: 18, thickness_mm: 14 },
  { ex: 2, layer: 2, code: "S2", number: 4, north: 498, east: 796, elev: 119.88, square: "2", material: "камень", find_type: "плитка", description: "Плитка без размеров" },
  { ex: 2, layer: 1, code: "S2", number: 5, north: 504, east: 808, elev: 120.05, square: "1", material: "стекло", find_type: "осколок", description: "Осколок сосуда", length_mm: 18, width_mm: 12, thickness_mm: 2 },
  { ex: 2, layer: 2, code: "S2", number: 6, north: 492, east: 800, elev: 119.95, square: "2", material: "керамика", find_type: "пряслице", description: "Обломок пряслица", length_mm: 26, width_mm: 20, thickness_mm: 9 },
];

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seed() {
  const users = [
    { id: 1, username: "field_arch", password: "FieldArch1", full_name: "Анна Полевая", email: "anna@field.local", role: "field_archaeologist", is_active: true, created_at: "2024-06-01T08:00:00" },
    { id: 2, username: "camera_arch", password: "CameraArch1", full_name: "Борис Камеральный", email: "boris@field.local", role: "camera_staff", is_active: true, created_at: "2024-06-01T08:05:00" },
    { id: 3, username: "supervisor_arch", password: "SuperArch1", full_name: "Мария Руководитель", email: "maria@field.local", role: "supervisor", is_active: true, created_at: "2024-06-01T08:10:00" },
  ];
  const excavations = [
    { id: 1, code: "R-1", year: 2024, place: "Городище", center_north: 1010, center_east: 2010, center_elev: 150.1, description: "Раскоп на площадке городища, сетка 5×5 м.", area_m2: 400, grid_step_m: 5, boundaries: "Северо-западный угол принят за опорный.", status: "active", created_at: "2024-07-01T09:00:00", updated_at: "2024-07-01T09:00:00" },
    { id: 2, code: "SH-2", year: 2025, place: "Склон", center_north: 500, center_east: 800, center_elev: 120, description: "Шурф у склона, контрольная зачистка.", area_m2: 100, grid_step_m: 5, boundaries: "Контур снят GNSS-приёмником.", status: "active", created_at: "2025-06-12T09:00:00", updated_at: "2025-06-12T09:00:00" },
  ];
  const layers = [
    { id: 1, excavation_id: 1, number: 1, top_elev: 150.4, bottom_elev: 150.2, description: "Гумус", color: "тёмно-коричневый", status: "open", surface_description: "Рыхлый тёмный гумус, углистые включения.", inclusions: "уголь, прокал", interpretation: "Гумус", note: null },
    { id: 2, excavation_id: 1, number: 2, top_elev: 150.2, bottom_elev: 150, description: "Суглинок", color: "серо-коричневый", status: "recorded", surface_description: "Плотный суглинок с прокалённой глиной.", inclusions: "уголь, прокал", interpretation: "Суглинок", note: null },
    { id: 3, excavation_id: 1, number: 3, top_elev: 150, bottom_elev: 149.75, description: "Материк", color: "светло-жёлтый", status: "closed", surface_description: "Светло-жёлтый материковый суглинок.", inclusions: null, interpretation: "Материк", note: null },
    { id: 4, excavation_id: 2, number: 1, top_elev: 120.2, bottom_elev: 120, description: "Дёрн", color: "серый", status: "open", surface_description: "Дёрн и современный мусор.", inclusions: "уголь, прокал", interpretation: "Дёрн", note: null },
    { id: 5, excavation_id: 2, number: 2, top_elev: 120, bottom_elev: 119.8, description: "Культурный слой", color: "коричневый", status: "recorded", surface_description: "Коричневый культурный слой.", inclusions: "уголь, прокал", interpretation: "Культурный слой", note: null },
  ].map((layer) => ({ ...layer, created_at: "2024-07-02T10:00:00", updated_at: "2024-07-02T10:00:00" }));

  const layerId = (ex, number) => layers.find((layer) => layer.excavation_id === ex && layer.number === number)?.id ?? null;
  const findings = FINDING_SEED.map((spec, index) => {
    const finding = {
      id: index + 1,
      excavation_id: spec.ex,
      layer_id: spec.layer == null ? null : layerId(spec.ex, spec.layer),
      pt: null,
      code: spec.code,
      number: spec.number,
      north: spec.north ?? null,
      east: spec.east ?? null,
      elev: spec.elev ?? null,
      square: spec.square ?? null,
      description: spec.description ?? null,
      material: spec.material ?? null,
      find_type: spec.find_type ?? null,
      quantity: 1,
      vessel_part: spec.vessel_part ?? null,
      ornament: spec.ornament ?? null,
      surface_color: spec.material === "стекло" ? "синий" : null,
      fracture_color: null,
      fabric: null,
      temper: null,
      surface_treatment: spec.surface_treatment ?? null,
      note: null,
      depth_cm: null,
      length_mm: spec.length_mm ?? null,
      width_mm: spec.width_mm ?? null,
      thickness_mm: spec.thickness_mm ?? null,
      measurement_method: spec.method || (spec.length_mm ? "manual" : "none"),
      photo_present: Boolean(spec.photo),
      record_status: "draft",
      created_at: "2024-07-14T11:00:00",
      updated_at: "2024-07-14T11:00:00",
    };
    refreshStatus(finding);
    return finding;
  });

  const gnss = [];
  const addCorners = (excavationId, corners) => {
    corners.forEach(([north, east, elev]) => {
      gnss.push({ id: gnss.length + 1, excavation_id: excavationId, north, east, elev, point_type: "corner", comment: "Угол раскопа", source_name: "demo.csv" });
    });
  };
  addCorners(1, [[1020, 2000, 150.3], [1020, 2020, 150.3], [1000, 2020, 150.28], [1000, 2000, 150.32]]);
  gnss.push({ id: gnss.length + 1, excavation_id: 1, north: 1010, east: 2010, elev: 150.1, point_type: "control", comment: "Центр раскопа", source_name: "demo.csv" });
  gnss.push({ id: gnss.length + 1, excavation_id: 1, north: 1008, east: 2012, elev: 150.05, point_type: "auxiliary", comment: "Вспомогательная точка", source_name: "demo.csv" });
  addCorners(2, [[510, 790, 120.2], [510, 810, 120.18], [490, 810, 120.16], [490, 790, 120.19]]);
  gnss.push({ id: gnss.length + 1, excavation_id: 2, north: 500, east: 800, elev: 120, point_type: "control", comment: "Центр раскопа", source_name: "demo.csv" });
  gnss.push({ id: gnss.length + 1, excavation_id: 2, north: 498, east: 802, elev: 119.95, point_type: "auxiliary", comment: "Вспомогательная точка", source_name: "demo.csv" });

  const photos = [];
  findings.filter((item) => item.photo_present).forEach((item) => {
    photos.push({
      id: photos.length + 1,
      finding_id: item.id,
      layer_id: item.layer_id,
      excavation_id: item.excavation_id,
      original_name: `${item.code}-${item.number}.png`,
      photo_type: "finding",
      author: "Анна Полевая",
      shot_date: "2024-07-12",
      has_scale: true,
      mime_type: "image/png",
      size_bytes: 180000,
      created_at: "2024-07-12T15:00:00",
    });
  });
  photos.push({ id: photos.length + 1, finding_id: null, layer_id: 1, excavation_id: 1, original_name: "layer-1.png", photo_type: "layer", author: "Анна Полевая", shot_date: "2024-07-12", has_scale: true, mime_type: "image/png", size_bytes: 180000, created_at: "2024-07-12T16:00:00" });
  photos.push({ id: photos.length + 1, finding_id: null, layer_id: null, excavation_id: 1, original_name: "excavation-r1.png", photo_type: "excavation", author: "Мария Руководитель", shot_date: "2024-07-10", has_scale: false, mime_type: "image/png", size_bytes: 180000, created_at: "2024-07-10T12:00:00" });

  const firstPhoto = photos.find((photo) => photo.finding_id === 1);
  const measurements = firstPhoto ? [
    { id: 1, finding_id: 1, photo_id: firstPhoto.id, measurement_type: "length", method: "photo", result_source: "user_points", detection_status: "detected", scale_pixel_distance: 400, scale_mm: 100, object_pixel_distance: 300, result_mm: 75, accepted: true, created_at: "2024-07-12T15:20:00" },
    { id: 2, finding_id: 1, photo_id: firstPhoto.id, measurement_type: "width", method: "photo", result_source: "user_points", detection_status: "detected", scale_pixel_distance: 400, scale_mm: 100, object_pixel_distance: 140, result_mm: 35, accepted: true, created_at: "2024-07-12T15:21:00" },
  ] : [];

  const materials = Object.entries(MATERIAL_COLORS).map(([name, color], index) => ({
    id: index + 1,
    name,
    code: ["ceramic", "metal", "bone", "stone", "glass", "flint", "wood", "clay"][index],
    color,
    is_active: true,
  }));

  return {
    seq: { user: 4, excavation: 3, layer: 6, finding: 19, gnss: gnss.length + 1, photo: photos.length + 1, measurement: 3, report: 1, template: 2, material: 9, audit: 2 },
    users,
    excavations,
    layers,
    findings,
    gnss,
    photos,
    measurements,
    reports: [],
    templates: [{ id: 1, name: "Минимальная опись", filters: {}, columns: MINIMAL_COLUMNS, sort: { sort: "number", order: "asc" } }],
    materials,
    photoTypes: [
      { id: 1, code: "finding", name: "Находка", is_active: true },
      { id: 2, code: "layer", name: "Пласт", is_active: true },
      { id: 3, code: "excavation", name: "Раскоп", is_active: true },
      { id: 4, code: "detail", name: "Деталь", is_active: true },
    ],
    gnssTypes: [
      { id: 1, code: "corner", name: "Угловая", is_active: true },
      { id: 2, code: "control", name: "Контрольная", is_active: true },
      { id: 3, code: "auxiliary", name: "Вспомогательная", is_active: true },
    ],
    methods: [
      { id: 1, code: "none", name: "Не указан", is_active: true },
      { id: 2, code: "photo", name: "По фото", is_active: true },
      { id: 3, code: "manual", name: "Ручное", is_active: true },
    ],
    schemes: [
      { id: 1, name: "По материалу", mode: "material", mapping: MATERIAL_COLORS, is_default: true, is_active: true },
      { id: 2, name: "По пласту", mode: "layer", mapping: {}, is_default: false, is_active: true },
    ],
    audit: [{ id: 1, at: "2024-07-01T09:00:00", user_id: 3, action: "create", entity: "excavation", entity_id: 1, details: "R-1" }],
    idempotency: {},
  };
}

function refreshStatus(finding) {
  const complete = finding.layer_id != null && finding.north != null && finding.east != null && finding.elev != null
    && finding.length_mm != null && finding.width_mm != null && finding.thickness_mm != null
    && finding.photo_present && Boolean(finding.code) && finding.number != null;
  finding.record_status = complete ? "complete" : "draft";
}

function issuesOf(finding) {
  const issues = [];
  if (finding.north == null || finding.east == null || finding.elev == null) issues.push("no_coordinates");
  if (finding.length_mm == null || finding.width_mm == null || finding.thickness_mm == null) issues.push("no_dimensions");
  if (!finding.photo_present) issues.push("no_photo");
  if (finding.layer_id == null) issues.push("no_layer");
  if (finding.record_status !== "complete") issues.push("incomplete");
  return issues;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённое хранилище заменяется семенами */ }
  const fresh = seed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function save(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetMock() {
  localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Ошибка запроса");
    this.status = status;
    this.detail = detail;
  }
}

function actor(db) {
  const token = localStorage.getItem("arch_token") || "";
  const id = Number(token.split(".").pop());
  const user = db.users.find((item) => item.id === id && item.is_active);
  if (!user) throw new ApiError(401, "Сессия истекла. Войдите снова.");
  return user;
}

function guard(user, level) {
  if (!allow(user, level)) throw new ApiError(403, "Недостаточно прав для этого действия");
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    role_label: ROLE_LABELS[user.role] || user.role,
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

function excavationView(db, excavation) {
  return {
    ...excavation,
    layer_count: db.layers.filter((layer) => layer.excavation_id === excavation.id).length,
    finding_count: db.findings.filter((item) => item.excavation_id === excavation.id).length,
    gnss_count: db.gnss.filter((item) => item.excavation_id === excavation.id).length,
  };
}

function layerView(db, layer) {
  const excavation = db.excavations.find((item) => item.id === layer.excavation_id);
  return {
    ...layer,
    excavation_code: excavation?.code ?? null,
    finding_count: db.findings.filter((item) => item.layer_id === layer.id).length,
    photo_count: db.photos.filter((item) => item.layer_id === layer.id).length,
  };
}

function findingView(db, finding) {
  const excavation = db.excavations.find((item) => item.id === finding.excavation_id);
  const layer = db.layers.find((item) => item.id === finding.layer_id);
  return {
    id: finding.id,
    excavation_id: finding.excavation_id,
    excavation_code: excavation?.code ?? null,
    excavation_year: excavation?.year ?? null,
    layer_id: finding.layer_id,
    layer_number: layer?.number ?? null,
    pt: finding.pt,
    code: finding.code,
    number: finding.number,
    north: finding.north,
    east: finding.east,
    elev: finding.elev,
    square: finding.square,
    description: finding.description,
    material: finding.material,
    find_type: finding.find_type,
    length_mm: finding.length_mm,
    width_mm: finding.width_mm,
    thickness_mm: finding.thickness_mm,
    measurement_method: finding.measurement_method,
    photo_present: finding.photo_present,
    record_status: finding.record_status,
    issues: issuesOf(finding),
    created_at: finding.created_at,
    updated_at: finding.updated_at,
  };
}

function findingDetail(db, finding) {
  return {
    ...findingView(db, finding),
    quantity: finding.quantity,
    vessel_part: finding.vessel_part,
    ornament: finding.ornament,
    surface_color: finding.surface_color,
    fracture_color: finding.fracture_color,
    fabric: finding.fabric,
    temper: finding.temper,
    surface_treatment: finding.surface_treatment,
    note: finding.note,
    depth_cm: finding.depth_cm,
    photos: db.photos.filter((photo) => photo.finding_id === finding.id),
    measurements: db.measurements.filter((row) => row.finding_id === finding.id),
  };
}

function audit(db, user, action, entity, entityId, details) {
  db.audit.unshift({ id: db.seq.audit++, at: now(), user_id: user.id, action, entity, entity_id: entityId, details });
}

function num(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new ApiError(422, "Ожидалось число");
  return parsed;
}

function applyFinding(target, data, partial) {
  const fields = ["code", "number", "square", "description", "material", "find_type", "quantity", "vessel_part", "ornament", "surface_color", "fracture_color", "fabric", "temper", "surface_treatment", "note", "pt", "depth_cm", "north", "east", "elev", "length_mm", "width_mm", "thickness_mm", "excavation_id", "layer_id", "measurement_method"];
  fields.forEach((key) => {
    if (!partial && data[key] === undefined) return;
    if (data[key] !== undefined) target[key] = data[key] === "" ? null : data[key];
  });
  if (target.layer_id === "") target.layer_id = null;
  ["number", "quantity", "pt", "excavation_id", "layer_id"].forEach((key) => {
    if (target[key] != null && target[key] !== "") target[key] = Number(target[key]);
  });
  ["north", "east", "elev", "length_mm", "width_mm", "thickness_mm", "depth_cm"].forEach((key) => {
    if (target[key] === "" || target[key] == null) target[key] = null;
    else target[key] = Number(target[key]);
  });
  if (!target.measurement_method) {
    target.measurement_method = target.length_mm != null ? "manual" : "none";
  }
  target.photo_present = Boolean(target.photo_present);
  target.updated_at = now();
  refreshStatus(target);
}

function listFindings(db, query) {
  let rows = db.findings.slice();
  const eq = (key, value) => {
    if (value) rows = rows.filter((item) => String(item[key] ?? "") === String(value));
  };
  if (query.get("excavation_id")) rows = rows.filter((item) => String(item.excavation_id) === query.get("excavation_id"));
  if (query.get("layer_id")) rows = rows.filter((item) => String(item.layer_id) === query.get("layer_id"));
  eq("code", query.get("code"));
  eq("material", query.get("material"));
  eq("square", query.get("square"));
  eq("find_type", query.get("find_type"));
  eq("measurement_method", query.get("measurement_method"));
  if (query.get("photo_present") === "true") rows = rows.filter((item) => item.photo_present);
  if (query.get("photo_present") === "false") rows = rows.filter((item) => !item.photo_present);
  const q = (query.get("q") || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((item) => [item.code, item.description, item.square, item.material, item.find_type, String(item.number)].join(" ").toLowerCase().includes(q));
  }
  const from = query.get("number_from");
  const to = query.get("number_to");
  if (from) rows = rows.filter((item) => item.number >= Number(from));
  if (to) rows = rows.filter((item) => item.number <= Number(to));
  const elevFrom = query.get("elev_from");
  const elevTo = query.get("elev_to");
  if (elevFrom) rows = rows.filter((item) => item.elev != null && item.elev >= Number(elevFrom));
  if (elevTo) rows = rows.filter((item) => item.elev != null && item.elev <= Number(elevTo));
  const sort = query.get("sort") || "code";
  const order = query.get("order") === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const av = sort === "layer" ? (db.layers.find((layer) => layer.id === a.layer_id)?.number ?? 0) : a[sort];
    const bv = sort === "layer" ? (db.layers.find((layer) => layer.id === b.layer_id)?.number ?? 0) : b[sort];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string") return av.localeCompare(bv, "ru") * order;
    return (av - bv) * order;
  });
  const page = Math.max(1, Number(query.get("page") || 1));
  const pageSize = Math.max(1, Number(query.get("page_size") || 50));
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize).map((item) => findingView(db, item)), total: rows.length, page, page_size: pageSize };
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].east;
    const yi = polygon[i].north;
    const xj = polygon[j].east;
    const yj = polygon[j].north;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function planPayload(db, query) {
  const excavation = db.excavations.find((item) => item.id === Number(query.get("excavation_id")));
  if (!excavation) throw new ApiError(404, "Раскоп не найден");
  const view = query.get("view") || "ne";
  const colorBy = query.get("color_by") || "material";
  const layerFilter = query.get("layer_id");
  const project = (north, east, elev) => {
    if (view === "n_elev") return { x: north, y: elev };
    if (view === "e_elev") return { x: east, y: elev };
    return { x: east, y: north };
  };
  const legend = {};
  const points = db.findings
    .filter((item) => item.excavation_id === excavation.id && item.north != null && item.east != null)
    .filter((item) => !layerFilter || String(item.layer_id) === layerFilter)
    .map((item) => {
      const layer = db.layers.find((row) => row.id === item.layer_id);
      const key = colorBy === "layer" ? (layer ? `Пласт ${layer.number}` : "без пласта") : (item.material || "без материала");
      const color = colorBy === "layer"
        ? LAYER_PALETTE[((layer?.number || 1) - 1) % LAYER_PALETTE.length]
        : (MATERIAL_COLORS[item.material] || "#7A7A7A");
      legend[key] = color;
      const xy = project(item.north, item.east, item.elev ?? excavation.center_elev);
      return { ...findingView(db, item), ...xy, color, legend_key: key };
    });
  const gnss = db.gnss.filter((item) => item.excavation_id === excavation.id).map((item) => ({
    ...item,
    point_type_label: GNSS_LABELS[item.point_type] || item.point_type,
    ...project(item.north, item.east, item.elev),
  }));
  const corners = gnss.filter((item) => item.point_type === "corner");
  const cx = corners.reduce((sum, item) => sum + item.east, 0) / (corners.length || 1);
  const cy = corners.reduce((sum, item) => sum + item.north, 0) / (corners.length || 1);
  const outline = corners
    .slice()
    .sort((a, b) => Math.atan2(a.north - cy, a.east - cx) - Math.atan2(b.north - cy, b.east - cx))
    .map((item) => ({ x: item.x, y: item.y, east: item.east, north: item.north }));
  const center = project(excavation.center_north, excavation.center_east, excavation.center_elev);
  const xs = points.map((item) => item.x).concat(gnss.map((item) => item.x), [center.x]);
  const ys = points.map((item) => item.y).concat(gnss.map((item) => item.y), [center.y]);
  const padX = Math.max((Math.max(...xs) - Math.min(...xs)) * 0.08, 1);
  const padY = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.08, 0.2);
  return {
    excavation_id: excavation.id,
    excavation_code: excavation.code,
    year: excavation.year,
    view,
    color_by: colorBy,
    layer_id: layerFilter ? Number(layerFilter) : null,
    center: { north: excavation.center_north, east: excavation.center_east, elev: excavation.center_elev, ...center },
    bounds: { min_x: Math.min(...xs) - padX, max_x: Math.max(...xs) + padX, min_y: Math.min(...ys) - padY, max_y: Math.max(...ys) + padY },
    outline,
    points,
    gnss_points: gnss,
    legend: Object.entries(legend).map(([key, color]) => ({ key, color })),
  };
}

function mmToCm(value) {
  if (value == null || value === "") return "";
  const text = (Number(value) / 10).toFixed(1).replace(/\.0$/, "").replace(".", ",");
  return text;
}

function reportRows(db, body) {
  const query = new URLSearchParams();
  ["excavation_id", "layer_id", "code", "material", "square", "find_type", "measurement_method", "number_from", "number_to", "elev_from", "elev_to"].forEach((key) => {
    if (body[key]) query.set(key, body[key]);
  });
  query.set("page", "1");
  query.set("page_size", "500");
  query.set("sort", body.sort || "number");
  query.set("order", body.order || "asc");
  const listed = listFindings(db, query).items;
  const layout = body.layout || "working";
  if (layout === "album") {
    if (!body.excavation_id) throw new ApiError(400, "Для альбома иллюстраций укажите раскоп");
    const excavation = db.excavations.find((item) => item.id === Number(body.excavation_id));
    const captions = [
      { key: "plan", label: `Рис. 1. План раскопа ${excavation?.code || body.excavation_id}` },
      ...listed.slice(0, 20).map((item, index) => ({
        key: `f${item.id}`,
        label: `Рис. ${index + 2}. ${item.code}-${item.number}. ${item.description || item.find_type || ""}`.trim(),
      })),
    ];
    return {
      columns: [{ key: "n", label: "№" }, { key: "caption", label: "Подпись" }],
      rows: captions.map((item, index) => ({ id: index + 1, cells: [String(index + 1), item.label] })),
      total: captions.length,
      layout: "album",
      title: body.title || `Альбом иллюстраций. Раскоп ${excavation?.code || ""}`,
    };
  }
  if (layout === "field" || layout === "collection") {
    const fieldColumns = [
      { key: "seq", label: "№ п/п" },
      { key: "name", label: "Наименование предмета" },
      { key: "quantity", label: "Кол-во ед.хр" },
      { key: "material", label: "Материал" },
      { key: "square", label: "Квадрат" },
      { key: "layer", label: "Пласт" },
      { key: "note", label: "Прим." },
    ];
    const collectionColumns = [
      { key: "seq", label: "№ п/п" },
      { key: "name", label: "Наименование" },
      { key: "sizes", label: "Размеры" },
      { key: "fracture_color", label: "Цвет в изломе" },
      { key: "ornament", label: "Орнамент" },
      { key: "surface_treatment", label: "Обработка поверхности" },
      { key: "field_number", label: "№ по полевой описи" },
      { key: "quantity", label: "Количество ед. хр." },
      { key: "material", label: "Материал" },
      { key: "condition", label: "Сохранность" },
      { key: "square", label: "Квадрат" },
      { key: "layer", label: "Пласт" },
      { key: "field_cipher", label: "Полевой шифр" },
      { key: "note", label: "Примечание" },
    ];
    const columns = layout === "field" ? fieldColumns : collectionColumns;
    const rows = listed.map((item, index) => {
      const full = db.findings.find((row) => row.id === item.id);
      const name = item.description || item.find_type || "";
      const layer = item.layer_number ?? "";
      const sizes = [mmToCm(item.length_mm), mmToCm(item.width_mm), mmToCm(item.thickness_mm)].filter(Boolean).join("×");
      const cipher = layer ? `${item.excavation_code}/${layer}/${item.number}` : `${item.excavation_code}/${item.number}`;
      const cells = layout === "field"
        ? [String(index + 1), name, String(full?.quantity ?? 1), item.material ?? "", item.square ?? "", layer, full?.note ?? ""]
        : [String(index + 1), name, sizes, full?.fracture_color ?? "", full?.ornament ?? "", full?.surface_treatment ?? "", String(item.number), String(full?.quantity ?? 1), item.material ?? "", "", item.square ?? "", layer, cipher, full?.note ?? ""];
      return { id: item.id, cells };
    });
    return { columns, rows, total: rows.length, layout };
  }
  const columns = body.preset === "extended" ? EXTENDED_COLUMNS : (body.columns?.length ? body.columns : MINIMAL_COLUMNS);
  const rows = listed.map((item) => {
    const full = db.findings.find((row) => row.id === item.id);
    const values = {
      code: item.code,
      number: item.number,
      excavation: item.excavation_code,
      layer: item.layer_number ?? "",
      square: item.square ?? "",
      material: item.material ?? "",
      north: item.north ?? "",
      east: item.east ?? "",
      elev: item.elev ?? "",
      length_mm: item.length_mm ?? "",
      width_mm: item.width_mm ?? "",
      thickness_mm: item.thickness_mm ?? "",
      description: item.description ?? "",
      find_type: item.find_type ?? "",
      quantity: full?.quantity ?? "",
      measurement_method: METHOD_LABELS[item.measurement_method] || item.measurement_method,
      photo_present: item.photo_present ? "да" : "нет",
      vessel_part: full?.vessel_part ?? "",
      ornament: full?.ornament ?? "",
      surface_color: full?.surface_color ?? "",
      note: full?.note ?? "",
      pt: full?.pt ?? "",
      depth_cm: full?.depth_cm ?? "",
    };
    return { id: item.id, cells: columns.map((key) => values[key] ?? "") };
  });
  return { columns: columns.map((key) => ({ key, label: COLUMN_LABELS[key] || key })), rows, total: rows.length, layout: "working" };
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], valid_count: 0, error_count: 0 };
  const header = lines[0].split(/[;,]/).map((cell) => cell.trim().toLowerCase());
  const index = (name) => header.indexOf(name);
  const rows = lines.slice(1).map((line, offset) => {
    const cells = line.split(/[;,]/).map((cell) => cell.trim());
    const row = { line: offset + 2, north: null, east: null, elev: null, point_type: "auxiliary", comment: "", status: "ok", errors: [] };
    const read = (name) => {
      const at = index(name);
      return at >= 0 ? cells[at] : "";
    };
    ["north", "east", "elev"].forEach((key) => {
      const raw = read(key);
      const value = Number(raw);
      if (raw === "" || Number.isNaN(value)) row.errors.push(`Нет числа в колонке ${key}`);
      else row[key] = value;
    });
    const typeRaw = (read("point_type") || "auxiliary").toLowerCase();
    const typeMap = { corner: "corner", control: "control", auxiliary: "auxiliary", угловая: "corner", контрольная: "control", вспомогательная: "auxiliary" };
    if (!typeMap[typeRaw]) row.errors.push("Неизвестный тип точки");
    else row.point_type = typeMap[typeRaw];
    row.comment = read("comment");
    row.status = row.errors.length ? "error" : "ok";
    return row;
  });
  return { rows, valid_count: rows.filter((row) => row.status === "ok").length, error_count: rows.filter((row) => row.status === "error").length };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function mockRequest(path, options = {}) {
  const db = load();
  const url = new URL(path, "http://mock.local");
  const method = (options.method || "GET").toUpperCase();
  const body = options.body || {};
  const query = url.searchParams;
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  const finish = (payload, status = 200) => {
    if (status >= 400) throw new ApiError(status, payload.detail || payload);
    save(db);
    return clone(payload);
  };

  try {
    if (pathname === "/api/health") return { status: "ok", mode: "mock" };

    if (pathname === "/api/auth/login" && method === "POST") {
      const user = db.users.find((item) => item.username === body.username && item.password === body.password && item.is_active);
      if (!user) throw new ApiError(401, "Неверное имя пользователя или пароль");
      audit(db, user, "login", "user", user.id, user.username);
      return finish({ access_token: `mock.${user.id}`, token_type: "bearer", user: publicUser(user) });
    }

    if (pathname === "/api/auth/register" && method === "POST") {
      if (!body.username || body.username.length < 3) throw new ApiError(422, "Имя пользователя слишком короткое");
      if (!body.password || body.password.length < 8) throw new ApiError(422, "Пароль должен быть не короче 8 символов");
      if (!body.full_name || body.full_name.length < 2) throw new ApiError(422, "Укажите полное имя");
      if (db.users.some((item) => item.username === body.username)) throw new ApiError(409, "Такой пользователь уже есть");
      const user = { id: db.seq.user++, username: body.username.trim(), password: body.password, full_name: body.full_name.trim(), email: body.email || null, role: "field_archaeologist", is_active: true, created_at: now() };
      db.users.push(user);
      audit(db, user, "register", "user", user.id, user.username);
      return finish({ access_token: `mock.${user.id}`, token_type: "bearer", user: publicUser(user) });
    }

    if (pathname === "/api/auth/me") return publicUser(actor(db));
    if (pathname === "/api/auth/logout" && method === "POST") {
      const user = actor(db);
      audit(db, user, "logout", "user", user.id, user.username);
      save(db);
      return { status: "ok" };
    }

    const user = actor(db);

    if (pathname === "/api/users" && method === "GET") {
      guard(user, 3);
      return db.users.map(publicUser);
    }
    if (pathname === "/api/users" && method === "POST") {
      guard(user, 3);
      if (db.users.some((item) => item.username === body.username)) throw new ApiError(409, "Такой пользователь уже есть");
      const role = query.get("role") || body.role || "field_archaeologist";
      if (!ROLE_LABELS[role]) throw new ApiError(422, "Неизвестная роль");
      const created = { id: db.seq.user++, username: body.username, password: body.password, full_name: body.full_name, email: body.email || null, role, is_active: true, created_at: now() };
      db.users.push(created);
      audit(db, user, "create", "user", created.id, created.username);
      return finish(publicUser(created));
    }
    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && method === "PUT") {
      guard(user, 3);
      const row = db.users.find((item) => item.id === Number(userMatch[1]));
      if (!row) throw new ApiError(404, "Пользователь не найден");
      if (body.full_name) row.full_name = body.full_name;
      if (body.email !== undefined) row.email = body.email;
      if (body.role) row.role = body.role;
      if (body.is_active != null) row.is_active = Boolean(body.is_active);
      if (body.password) row.password = body.password;
      audit(db, user, "update", "user", row.id, row.username);
      return finish(publicUser(row));
    }

    if (pathname === "/api/excavations" && method === "GET") {
      let rows = db.excavations.slice();
      if (query.get("status")) rows = rows.filter((item) => item.status === query.get("status"));
      rows.sort((a, b) => b.year - a.year || a.code.localeCompare(b.code));
      return rows.map((item) => excavationView(db, item));
    }
    if (pathname === "/api/excavations" && method === "POST") {
      guard(user, 3);
      if (db.excavations.some((item) => item.code === body.code && item.year === Number(body.year))) {
        throw new ApiError(409, "Раскоп с таким кодом и годом уже существует");
      }
      const created = {
        id: db.seq.excavation++,
        code: String(body.code).trim(),
        year: Number(body.year),
        place: body.place || "Поле",
        center_north: num(body.center_north),
        center_east: num(body.center_east),
        center_elev: num(body.center_elev),
        description: body.description || null,
        area_m2: body.area_m2 === "" || body.area_m2 == null ? null : num(body.area_m2),
        grid_step_m: body.grid_step_m ? num(body.grid_step_m) : 5,
        boundaries: body.boundaries || null,
        status: "active",
        created_at: now(),
        updated_at: now(),
      };
      db.excavations.push(created);
      audit(db, user, "create", "excavation", created.id, created.code);
      return finish(excavationView(db, created));
    }
    const exMatch = pathname.match(/^\/api\/excavations\/(\d+)(?:\/(layers|checks|archive|restore))?$/);
    if (exMatch) {
      const excavation = db.excavations.find((item) => item.id === Number(exMatch[1]));
      if (!excavation) throw new ApiError(404, "Раскоп не найден");
      const action = exMatch[2];
      if (!action && method === "GET") return excavationView(db, excavation);
      if (action === "layers" && method === "GET") return db.layers.filter((layer) => layer.excavation_id === excavation.id).map((layer) => layerView(db, layer));
      if (action === "checks" && method === "GET") {
        const findings = db.findings.filter((item) => item.excavation_id === excavation.id);
        const corners = db.gnss.filter((item) => item.excavation_id === excavation.id && item.point_type === "corner");
        const outside = findings.filter((item) => item.east != null && item.north != null && corners.length >= 3 && !insidePolygon(item.east, item.north, corners)).map((item) => item.id);
        const elevOutside = findings.filter((item) => {
          const layer = db.layers.find((row) => row.id === item.layer_id);
          return layer && item.elev != null && (item.elev > layer.top_elev || item.elev < layer.bottom_elev);
        }).map((item) => item.id);
        return {
          excavation_id: excavation.id,
          missing_coordinates: findings.filter((item) => item.north == null || item.east == null || item.elev == null).map((item) => item.id),
          missing_dimensions: findings.filter((item) => item.length_mm == null || item.width_mm == null || item.thickness_mm == null).map((item) => item.id),
          missing_photos: findings.filter((item) => !item.photo_present).map((item) => item.id),
          missing_layers: findings.filter((item) => item.layer_id == null).map((item) => item.id),
          elev_outside_layer: elevOutside,
          outside_contour: outside,
        };
      }
      if (method === "PUT" && !action) {
        guard(user, 3);
        Object.assign(excavation, body, { updated_at: now() });
        audit(db, user, "update", "excavation", excavation.id, excavation.code);
        return finish(excavationView(db, excavation));
      }
      if (method === "DELETE" && !action) {
        guard(user, 3);
        db.excavations = db.excavations.filter((item) => item.id !== excavation.id);
        return finish({ status: "deleted" });
      }
      if (action === "archive" && method === "POST") {
        guard(user, 3);
        excavation.status = "archived";
        excavation.updated_at = now();
        audit(db, user, "archive", "excavation", excavation.id, excavation.code);
        return finish(excavationView(db, excavation));
      }
      if (action === "restore" && method === "POST") {
        guard(user, 3);
        excavation.status = "active";
        excavation.updated_at = now();
        audit(db, user, "restore", "excavation", excavation.id, excavation.code);
        return finish(excavationView(db, excavation));
      }
    }

    if (pathname === "/api/layers" && method === "GET") {
      let rows = db.layers.slice();
      if (query.get("excavation_id")) rows = rows.filter((layer) => String(layer.excavation_id) === query.get("excavation_id"));
      return rows.sort((a, b) => a.number - b.number).map((layer) => layerView(db, layer));
    }
    if (pathname === "/api/layers" && method === "POST") {
      guard(user, 1);
      if (Number(body.top_elev) < Number(body.bottom_elev)) throw new ApiError(422, "Верхняя отметка пласта не может быть ниже нижней");
      const created = { id: db.seq.layer++, ...body, excavation_id: Number(body.excavation_id), number: Number(body.number), top_elev: Number(body.top_elev), bottom_elev: Number(body.bottom_elev), status: body.status || "open", created_at: now(), updated_at: now() };
      db.layers.push(created);
      audit(db, user, "create", "layer", created.id, String(created.number));
      return finish(layerView(db, created));
    }
    const layerMatch = pathname.match(/^\/api\/layers\/(\d+)$/);
    if (layerMatch) {
      const layer = db.layers.find((item) => item.id === Number(layerMatch[1]));
      if (!layer) throw new ApiError(404, "Пласт не найден");
      if (method === "GET") return layerView(db, layer);
      guard(user, 2);
      if (method === "PUT") {
        const nextTop = body.top_elev != null ? Number(body.top_elev) : layer.top_elev;
        const nextBottom = body.bottom_elev != null ? Number(body.bottom_elev) : layer.bottom_elev;
        if (nextTop < nextBottom) throw new ApiError(422, "Верхняя отметка пласта не может быть ниже нижней");
        Object.assign(layer, body, { top_elev: nextTop, bottom_elev: nextBottom, updated_at: now() });
        audit(db, user, "update", "layer", layer.id, layer.description || String(layer.number));
        return finish(layerView(db, layer));
      }
      if (method === "DELETE") {
        if (db.findings.some((item) => item.layer_id === layer.id)) throw new ApiError(409, "В пласте есть находки");
        db.layers = db.layers.filter((item) => item.id !== layer.id);
        return finish({ status: "deleted" });
      }
    }

    if (pathname === "/api/findings" && method === "GET") return listFindings(db, query);
    if (pathname === "/api/findings" && method === "POST") {
      guard(user, 1);
      const key = options.idempotencyKey;
      if (key && db.idempotency[`${user.id}:${key}`]) return db.idempotency[`${user.id}:${key}`];
      const created = {
        id: db.seq.finding++,
        excavation_id: Number(body.excavation_id),
        layer_id: body.layer_id ? Number(body.layer_id) : null,
        code: body.code,
        number: Number(body.number),
        quantity: body.quantity ? Number(body.quantity) : 1,
        measurement_method: "none",
        photo_present: false,
        record_status: "draft",
        created_at: now(),
        updated_at: now(),
      };
      applyFinding(created, body, true);
      if (!db.excavations.some((item) => item.id === created.excavation_id)) throw new ApiError(404, "Раскоп не найден");
      db.findings.push(created);
      audit(db, user, "create", "finding", created.id, `${created.code}-${created.number}`);
      const payload = findingDetail(db, created);
      if (key) db.idempotency[`${user.id}:${key}`] = payload;
      return finish(payload);
    }
    const findingMeasure = pathname.match(/^\/api\/findings\/(\d+)\/measure$/);
    if (findingMeasure && method === "POST") {
      guard(user, 1);
      const finding = db.findings.find((item) => item.id === Number(findingMeasure[1]));
      if (!finding) throw new ApiError(404, "Находка не найдена");
      if (!body.object_points || body.object_points.length !== 2) throw new ApiError(422, "Нужны две точки измеряемого участка");
      const photo = db.photos.find((item) => item.id === Number(body.photo_id));
      if (!photo) throw new ApiError(404, "Фотография не найдена");
      const scalePoints = body.scale_points || [{ x: 100, y: 78 }, { x: 500, y: 78 }];
      const scalePx = distance(scalePoints[0], scalePoints[1]);
      const objectPx = distance(body.object_points[0], body.object_points[1]);
      if (!scalePx || !body.scale_mm) throw new ApiError(422, "Укажите масштаб");
      const result = Math.round((objectPx * Number(body.scale_mm) / scalePx) * 10) / 10;
      const row = {
        id: db.seq.measurement++,
        finding_id: finding.id,
        photo_id: photo.id,
        measurement_type: body.measurement_type,
        method: "photo",
        result_source: body.scale_points ? "user_points" : "auto_marker",
        detection_status: "detected",
        scale_pixel_distance: Math.round(scalePx * 10) / 10,
        scale_mm: Number(body.scale_mm),
        object_pixel_distance: Math.round(objectPx * 10) / 10,
        result_mm: result,
        accepted: Boolean(body.accept),
        created_at: now(),
      };
      db.measurements.push(row);
      if (body.accept) {
        if (body.measurement_type === "length") finding.length_mm = result;
        if (body.measurement_type === "width") finding.width_mm = result;
        if (body.measurement_type === "thickness") finding.thickness_mm = result;
        finding.measurement_method = "photo";
        refreshStatus(finding);
      }
      audit(db, user, "measure", "finding", finding.id, `${body.measurement_type}=${result}`);
      return finish({ ...row, finding: findingDetail(db, finding) });
    }
    const findingExtra = pathname.match(/^\/api\/findings\/(\d+)(?:\/(coordinates|dimensions))?$/);
    if (findingExtra) {
      const finding = db.findings.find((item) => item.id === Number(findingExtra[1]));
      if (!finding) throw new ApiError(404, "Находка не найдена");
      const extra = findingExtra[2];
      if (!extra && method === "GET") return findingDetail(db, finding);
      if (!extra && method === "PUT") {
        guard(user, 1);
        if (body.measurement_method === "manual") guard(user, 2);
        applyFinding(finding, body, false);
        audit(db, user, "update", "finding", finding.id, finding.code);
        return finish(findingDetail(db, finding));
      }
      if (!extra && method === "DELETE") {
        guard(user, 2);
        db.findings = db.findings.filter((item) => item.id !== finding.id);
        db.photos.forEach((photo) => { if (photo.finding_id === finding.id) photo.finding_id = null; });
        return finish({ status: "deleted" });
      }
      if (extra === "coordinates" && method === "PUT") {
        guard(user, 1);
        finding.north = num(body.north);
        finding.east = num(body.east);
        finding.elev = num(body.elev);
        refreshStatus(finding);
        return finish(findingDetail(db, finding));
      }
      if (extra === "dimensions" && method === "PUT") {
        guard(user, 1);
        if ((body.measurement_method || "manual") === "manual") guard(user, 2);
        finding.length_mm = body.length_mm == null ? finding.length_mm : num(body.length_mm);
        finding.width_mm = body.width_mm == null ? finding.width_mm : num(body.width_mm);
        finding.thickness_mm = body.thickness_mm == null ? finding.thickness_mm : num(body.thickness_mm);
        finding.measurement_method = body.measurement_method || "manual";
        refreshStatus(finding);
        return finish(findingDetail(db, finding));
      }
    }

    if (pathname === "/api/photos" && method === "GET") {
      return db.photos.filter((photo) => {
        if (query.get("finding_id") && String(photo.finding_id) !== query.get("finding_id")) return false;
        if (query.get("layer_id") && String(photo.layer_id) !== query.get("layer_id")) return false;
        if (query.get("excavation_id") && String(photo.excavation_id) !== query.get("excavation_id")) return false;
        return true;
      });
    }
    if (pathname === "/api/photos" && method === "POST") {
      guard(user, 1);
      const created = {
        id: db.seq.photo++,
        finding_id: body.finding_id ? Number(body.finding_id) : null,
        layer_id: body.layer_id ? Number(body.layer_id) : null,
        excavation_id: body.excavation_id ? Number(body.excavation_id) : null,
        original_name: body.original_name || "photo.png",
        photo_type: body.photo_type || "finding",
        author: body.author || user.full_name,
        shot_date: body.shot_date || now().slice(0, 10),
        has_scale: Boolean(body.has_scale),
        mime_type: "image/png",
        size_bytes: 120000,
        created_at: now(),
      };
      db.photos.push(created);
      if (created.finding_id) {
        const finding = db.findings.find((item) => item.id === created.finding_id);
        if (finding) {
          finding.photo_present = true;
          refreshStatus(finding);
        }
      }
      audit(db, user, "create", "photo", created.id, created.original_name);
      return finish(created);
    }
    const photoMatch = pathname.match(/^\/api\/photos\/(\d+)(?:\/(analyze|detect-scale))?$/);
    if (photoMatch) {
      const photo = db.photos.find((item) => item.id === Number(photoMatch[1]));
      if (!photo) throw new ApiError(404, "Фотография не найдена");
      if (!photoMatch[2] && method === "GET") return photo;
      if (photoMatch[2] === "detect-scale" && method === "POST") {
        if (!photo.has_scale) return { status: "marker_not_found", scale_points: null, message: "Маркер масштаба не найден" };
        return { status: "detected", scale_points: [{ x: 100, y: 78 }, { x: 500, y: 78 }], message: "Найдена контрастная полоса масштаба" };
      }
      if (photoMatch[2] === "analyze" && method === "POST") {
        if (!photo.has_scale) {
          return { status: "marker_not_found", scale_points: [], length_points: [], width_points: [], message: "Маркер масштаба не найден" };
        }
        return {
          status: "detected",
          scale_points: [{ x: 100, y: 78 }, { x: 500, y: 78 }],
          length_points: [{ x: 160, y: 240 }, { x: 460, y: 240 }],
          width_points: [{ x: 310, y: 180 }, { x: 310, y: 300 }],
          length_mm: 75,
          width_mm: 30,
          message: "Маркер и контур предмета найдены автоматически. Проверьте линии и нажмите «Принять».",
        };
      }
      if (method === "DELETE") {
        guard(user, 1);
        db.photos = db.photos.filter((item) => item.id !== photo.id);
        if (photo.finding_id) {
          const finding = db.findings.find((item) => item.id === photo.finding_id);
          if (finding) {
            finding.photo_present = db.photos.some((item) => item.finding_id === finding.id);
            refreshStatus(finding);
          }
        }
        return finish({ status: "deleted" });
      }
    }

    if (pathname === "/api/gnss" && method === "GET") {
      let rows = db.gnss.slice();
      if (query.get("excavation_id")) rows = rows.filter((item) => String(item.excavation_id) === query.get("excavation_id"));
      return rows.map((item) => ({ ...item, point_type_label: GNSS_LABELS[item.point_type] || item.point_type }));
    }
    if (pathname === "/api/gnss/preview" && method === "POST") {
      guard(user, 1);
      const file = options.formData?.get("file");
      const text = options.text ?? (file && typeof file === "string" ? file : body.text || "");
      return parseCsv(text);
    }
    if (pathname === "/api/gnss/import" && method === "POST") {
      guard(user, 1);
      const created = (body.points || []).map((point) => ({
        id: db.seq.gnss++,
        excavation_id: Number(body.excavation_id),
        north: Number(point.north),
        east: Number(point.east),
        elev: Number(point.elev),
        point_type: point.point_type || "auxiliary",
        comment: point.comment || "",
        source_name: body.source_name || "import.csv",
      }));
      db.gnss.push(...created);
      audit(db, user, "import", "gnss", Number(body.excavation_id), `${created.length} точек`);
      return finish({ imported: created.length, points: created.map((item) => ({ ...item, point_type_label: GNSS_LABELS[item.point_type] })) });
    }
    const gnssMatch = pathname.match(/^\/api\/gnss\/(\d+)$/);
    if (gnssMatch && method === "DELETE") {
      guard(user, 2);
      db.gnss = db.gnss.filter((item) => item.id !== Number(gnssMatch[1]));
      return finish({ status: "deleted" });
    }

    if (pathname === "/api/plan" && method === "GET") return planPayload(db, query);

    if (pathname === "/api/reports/findings" && method === "POST") {
      guard(user, 2);
      return reportRows(db, body);
    }
    if (pathname === "/api/reports/export" && method === "POST") {
      guard(user, 2);
      const preview = reportRows(db, body);
      const header = preview.columns.map((column) => column.label).join(";");
      const lines = preview.rows.map((row) => row.cells.join(";"));
      const report = { id: db.seq.report++, title: body.title || `Опись ${now().slice(0, 10)}`, format: body.format || "xlsx", confirmed: false, created_at: now(), total: preview.total, created_by: user.full_name };
      db.reports.unshift(report);
      audit(db, user, "export", "report", report.id, report.title);
      const content = body.format === "pdf"
        ? preview
        : `\uFEFF${header}\n${lines.join("\n")}`;
      save(db);
      return { report_id: report.id, filename: body.format === "pdf" ? "opis.html" : "opis.csv", mime: body.format === "pdf" ? "text/html" : "text/csv", content, preview };
    }
    if (pathname === "/api/reports/print" && method === "POST") {
      guard(user, 2);
      const preview = reportRows(db, body);
      const head = preview.columns.map((column) => `<th>${column.label}</th>`).join("");
      const bodyRows = preview.rows.map((row) => `<tr>${row.cells.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`).join("");
      return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${body.title || "Полевая опись"}</title><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #111;padding:4px 6px;font-size:12px}</style></head><body><h1>${body.title || "Полевая опись"}</h1><table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
    }
    if (pathname === "/api/reports" && method === "GET") {
      guard(user, 2);
      return db.reports;
    }
    const confirmMatch = pathname.match(/^\/api\/reports\/(\d+)\/confirm$/);
    if (confirmMatch && method === "POST") {
      guard(user, 3);
      const report = db.reports.find((item) => item.id === Number(confirmMatch[1]));
      if (!report) throw new ApiError(404, "Опись не найдена");
      report.confirmed = true;
      report.confirmed_by = user.full_name;
      audit(db, user, "confirm", "report", report.id, report.title);
      return finish(report);
    }
    if (pathname === "/api/reports/templates" && method === "GET") {
      guard(user, 2);
      return db.templates;
    }
    if (pathname === "/api/reports/templates" && method === "POST") {
      guard(user, 2);
      const created = { id: db.seq.template++, name: body.name, filters: body.filters || {}, columns: body.columns || [], sort: body.sort || {} };
      db.templates.push(created);
      return finish(created);
    }
    const templateMatch = pathname.match(/^\/api\/reports\/templates\/(\d+)$/);
    if (templateMatch && method === "DELETE") {
      guard(user, 2);
      db.templates = db.templates.filter((item) => item.id !== Number(templateMatch[1]));
      return finish({ status: "deleted" });
    }

    if (pathname === "/api/dictionaries" && method === "GET") {
      return { materials: db.materials, photo_types: db.photoTypes, gnss_point_types: db.gnssTypes, measurement_methods: db.methods, color_schemes: db.schemes };
    }
    if (pathname === "/api/dictionaries/materials" && method === "POST") {
      guard(user, 3);
      if (db.materials.some((item) => item.name.toLowerCase() === String(body.name).toLowerCase())) throw new ApiError(409, "Такой материал уже есть в справочнике");
      const created = { id: db.seq.material++, name: body.name, code: body.code || null, color: body.color || "#5c6b73", is_active: true };
      db.materials.push(created);
      audit(db, user, "create", "material", created.id, created.name);
      return finish(created);
    }
    const materialMatch = pathname.match(/^\/api\/dictionaries\/materials\/(\d+)$/);
    if (materialMatch && method === "PUT") {
      guard(user, 3);
      const row = db.materials.find((item) => item.id === Number(materialMatch[1]));
      if (!row) throw new ApiError(404, "Материал не найден");
      Object.assign(row, body);
      return finish(row);
    }
    const named = pathname.match(/^\/api\/dictionaries\/(photo-types|gnss-types|measurement-methods|color-schemes)\/(\d+)$/);
    if (named && method === "PUT") {
      guard(user, 3);
      const table = { "photo-types": db.photoTypes, "gnss-types": db.gnssTypes, "measurement-methods": db.methods, "color-schemes": db.schemes }[named[1]];
      const row = table.find((item) => item.id === Number(named[2]));
      if (!row) throw new ApiError(404, "Запись справочника не найдена");
      Object.assign(row, body);
      return finish(row);
    }

    if (pathname === "/api/audit" && method === "GET") {
      guard(user, 3);
      return db.audit.slice(0, 40).map((item) => ({ ...item, user_name: db.users.find((row) => row.id === item.user_id)?.full_name || "" }));
    }

    throw new ApiError(404, "Маршрут не найден");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "Внутренняя ошибка");
  }
}
