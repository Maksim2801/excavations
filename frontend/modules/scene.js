const WIDTH = 800;
const HEIGHT = 560;

export const SCENE = {
  width: WIDTH,
  height: HEIGHT,
  scale: [{ x: 100, y: 78 }, { x: 500, y: 78 }],
  length: [{ x: 160, y: 250 }, { x: 460, y: 250 }],
  width: [{ x: 180, y: 180 }, { x: 180, y: 320 }],
  thickness: [{ x: 520, y: 200 }, { x: 560, y: 250 }],
};

export function drawScene(canvas, photo) {
  const ctx = canvas.getContext("2d");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  ctx.fillStyle = "#d7c4a3";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#c4ad88";
  for (let i = 0; i < 18; i += 1) {
    ctx.fillRect((i * 97) % WIDTH, (i * 53) % HEIGHT, 40, 18);
  }
  ctx.fillStyle = "#2a241e";
  ctx.fillRect(150, 170, 330, 180);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeRect(150, 170, 330, 180);
  if (photo?.has_scale) {
    ctx.strokeStyle = "#f2d48a";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(SCENE.scale[0].x, SCENE.scale[0].y);
    ctx.lineTo(SCENE.scale[1].x, SCENE.scale[1].y);
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "16px sans-serif";
    ctx.fillText("100 мм", 250, 68);
  }
  ctx.fillStyle = "#111";
  ctx.font = "18px sans-serif";
  ctx.fillText(photo?.original_name || "снимок", 24, HEIGHT - 24);
}

export function sceneImage(photo) {
  const canvas = document.createElement("canvas");
  drawScene(canvas, photo);
  return canvas.toDataURL("image/png");
}
