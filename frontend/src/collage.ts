// 用前端 Canvas 把所选素材拼成一张「搭配预览卡」。
// 纯代码、零成本、瞬间生成，用作视频生成期间的缓冲展示。
// 注意：这不是真实换装效果，仅是所选搭配的一览。

export interface CollageInput {
  person?: string;
  scene?: string;
  clothing?: string;
  accessory?: string;
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// 等比裁剪填充（object-fit: cover）
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function buildCollage(input: CollageInput): Promise<string> {
  const W = 720;
  const H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 背景：场景图（暗化）或纯色
  if (input.scene) {
    const s = await loadImg(input.scene);
    drawCover(ctx, s, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#2a2a35";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "rgba(20,16,40,0.45)";
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText("✨ 搭配预览", W / 2, 72);

  // 人物主图
  if (input.person) {
    const p = await loadImg(input.person);
    const pw = 420;
    const ph = 560;
    const px = (W - pw) / 2;
    const py = 110;
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 24);
    ctx.clip();
    drawCover(ctx, p, px, py, pw, ph);
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, px, py, pw, ph, 24);
    ctx.stroke();
  }

  // 单品缩略图（底部一排）
  const items = [input.clothing, input.accessory].filter(Boolean) as string[];
  if (items.length > 0) {
    const tn = 120;
    const gap = 28;
    const totalW = items.length * tn + (items.length - 1) * gap;
    let ix = (W - totalW) / 2;
    const iy = H - tn - 70;
    for (const it of items) {
      const im = await loadImg(it);
      ctx.save();
      roundRect(ctx, ix, iy, tn, tn, 16);
      ctx.clip();
      drawCover(ctx, im, ix, iy, tn, tn);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      roundRect(ctx, ix, iy, tn, tn, 16);
      ctx.stroke();
      ix += tn + gap;
    }
  }

  // 底部提示
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("🎬 视频生成中，请稍候…", W / 2, H - 28);

  return canvas.toDataURL("image/jpeg", 0.9);
}