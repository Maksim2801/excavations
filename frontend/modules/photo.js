import { html, useEffect, useRef, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { authorizedBlob, findingsApi, getMode, photosApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading } from "./ui.js";
import { SCENE, sceneImage } from "./scene.js";

const COLORS = { scale: "#c2881b", length: "#8c3a2f", width: "#2f5f8a", thickness: "#2f6b4f" };
const MODES = [["scale", "Масштаб"], ["length", "Длина"], ["width", "Ширина"], ["thickness", "Толщина"]];

export function PhotoPage({ findingId }) {
  const { user } = useSession();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const press = useRef(null);
  const [selectedId, setSelectedId] = useState(findingId || "");
  const [photoId, setPhotoId] = useState(null);
  const [scaleMm, setScaleMm] = useState(100);
  const [mode, setMode] = useState("scale");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [lines, setLines] = useState({ scale: [], length: [], width: [], thickness: [] });
  const [result, setResult] = useState("Выберите фотографию, укажите масштаб и линии.");
  const findings = useQuery(() => findingsApi.list({ page_size: 200 }), []);
  const activeId = selectedId || findings.data?.items?.[0]?.id || "";
  const photos = useQuery(() => (activeId ? photosApi.list({ finding_id: activeId }) : Promise.resolve([])), [activeId]);
  const photo = (photos.data || []).find((item) => item.id === photoId) || photos.data?.[0] || null;

  useEffect(() => { setPhotoId(null); setLines({ scale: [], length: [], width: [], thickness: [] }); }, [activeId]);

  useEffect(() => {
    let revoke = "";
    const image = new Image();
    imageRef.current = image;
    if (!photo) return undefined;
    const apply = (src) => { image.src = src; };
    if (getMode() === "live") {
      authorizedBlob(`/api/photos/${photo.id}/file`).then((url) => { revoke = url; apply(url); }).catch((error) => setStatus(error.message, "error"));
    } else apply(sceneImage(photo));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [photo?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#efe8dc";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, pan.x, pan.y, image.naturalWidth * zoom, image.naturalHeight * zoom);
      Object.entries(lines).forEach(([name, points]) => {
        if (!points.length) return;
        ctx.strokeStyle = COLORS[name];
        ctx.fillStyle = COLORS[name];
        ctx.lineWidth = 3;
        ctx.beginPath();
        points.forEach((point, index) => {
          const x = point.x * zoom + pan.x;
          const y = point.y * zoom + pan.y;
          if (index) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          ctx.fillRect(x - 4, y - 4, 8, 8);
        });
        ctx.stroke();
      });
    };
    image?.addEventListener("load", draw);
    draw();
    return () => image?.removeEventListener("load", draw);
  }, [lines, zoom, pan, photo?.id]);

  const toImage = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom };
  };

  const onUp = (event) => {
    const start = press.current;
    press.current = null;
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > 5) return;
    const point = toImage(event);
    setLines((current) => {
      const next = current[mode].length >= 2 ? [point] : current[mode].concat(point);
      return { ...current, [mode]: next };
    });
  };

  const detect = async () => {
    if (!photo) return;
    try {
      const detected = await photosApi.analyze(photo.id, Number(scaleMm) || 100);
      const scale = detected.scale_points || detected.points || [];
      const length = detected.length_points || [];
      const width = detected.width_points || [];
      if (scale.length === 2 || length.length === 2 || width.length === 2) {
        setLines((current) => ({
          ...current,
          scale: scale.length === 2 ? scale : current.scale,
          length: length.length === 2 ? length : current.length,
          width: width.length === 2 ? width : current.width,
        }));
        setMode(length.length === 2 ? "length" : "scale");
        if (detected.length_mm != null || detected.width_mm != null) {
          setResult(`Предложено: длина ${detected.length_mm ?? "—"} мм, ширина ${detected.width_mm ?? "—"} мм. Проверьте линии и нажмите «Принять».`);
        }
        setStatus(detected.message || "Маркер найден", detected.status === "detected" ? "ok" : "warn");
      } else setStatus(detected.message || "Маркер не найден", "warn");
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const accept = async () => {
    if (!photo || !activeId) return;
    const scale = lines.scale.length === 2 ? lines.scale : SCENE.scale;
    const kinds = ["length", "width", "thickness"].filter((kind) => lines[kind].length === 2);
    if (!kinds.length) {
      setStatus("Отметьте две точки длины, ширины или толщины", "warn");
      return;
    }
    try {
      let last = null;
      for (const kind of kinds) {
        last = await findingsApi.measure(activeId, {
          photo_id: photo.id,
          measurement_type: kind,
          scale_mm: Number(scaleMm),
          scale_points: scale,
          object_points: lines[kind],
          accept: true,
        });
      }
      const row = last;
      setResult(`${kinds.join(", ")}: ${row.result_mm} мм. Способ измерения — по фото.`);
      setStatus("Размер принят", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeId) return;
    try {
      const created = await photosApi.upload({
        finding_id: activeId,
        excavation_id: workspace.excavationId,
        photo_type: "finding",
        author: user?.full_name,
        has_scale: true,
      }, file);
      setStatus("Фотография добавлена", "ok");
      setPhotoId(created.id);
      photos.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  return html`<section className="photo-page">
    <${Breadcrumbs} items=${[{ label: "Опись", href: "/inventory" }, { label: "Фотоанализ" }]} />
    <${SectionHeading}>Фотоанализ<//>
    <div className="filter-bar photo-filter-bar">
      <${Field} label="Находка"><select value=${activeId} onChange=${(event) => setSelectedId(event.target.value)}>
        ${(findings.data?.items || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code}-${item.number}</option>`)}
      </select></${Field}>
      <${Field} label="Снимок"><select value=${photo?.id || ""} onChange=${(event) => setPhotoId(Number(event.target.value))}>
        ${(photos.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.original_name}</option>`)}
      </select></${Field}>
      <${Field} label="Масштаб, мм"><input type="number" min="0.1" step="0.1" value=${scaleMm} onInput=${(event) => setScaleMm(event.target.value)} /></${Field}>
      <label className="btn btn-line file-button">Добавить фото<input type="file" accept="image/*" onChange=${upload} /></label>
    </div>
    <div className="actions photo-actions">
      ${MODES.map(([key, label]) => html`<button type="button" key=${key} className=${mode === key ? "btn btn-gold" : "btn btn-line"} onClick=${() => setMode(key)}>${label}</button>`)}
      <button type="button" className="btn btn-line" onClick=${detect}>Распознать маркер</button>
      <button type="button" className="btn btn-gold" onClick=${accept}>Принять</button>
    </div>
    <p className="muted">Сейчас отмечается ${MODES.find((item) => item[0] === mode)?.[1]?.toLowerCase()}. Щёлкните две точки. Перетаскивание сдвигает снимок, колесо меняет масштаб просмотра.</p>
    <${ErrorText} error=${photos.error || findings.error} />
    <div className="photo-layout">
      <div className="canvas-wrap">
        <canvas ref=${canvasRef} className="plan-canvas" onMouseDown=${(event) => { press.current = { x: event.clientX, y: event.clientY, pan }; }} onMouseMove=${(event) => {
          if (!press.current || !event.buttons) return;
          setPan({ x: press.current.pan.x + event.clientX - press.current.x, y: press.current.pan.y + event.clientY - press.current.y });
        }} onMouseUp=${onUp} onWheel=${(event) => { event.preventDefault(); setZoom((value) => Math.min(4, Math.max(0.4, value + (event.deltaY < 0 ? 0.1 : -0.1)))); }}></canvas>
      </div>
      <aside className="info-card">
        <h3>Результат</h3>
        <p>${result}</p>
        <p className="muted">Жёлтая линия — масштаб, красная — длина, синяя — ширина, зелёная — толщина. Толщина по одному снимку сверху не определяется надёжно: линию нужно проверить.</p>
      </aside>
    </div>
  </section>`;
}
