// 用前端 Canvas 把所选素材拼成一张精致的「造型卡 / lookbook」。
// 纯代码、零成本、瞬间生成，用作视频生成期间的缓冲展示。
// 注意：这不是真实换装效果（人并未真的穿上衣服），而是所选搭配的时尚排版一览。

export interface CollageItem {
  url: string;
  label: string;
}

export interface CollageInput {
  person?: string;
  scene?: string;
  items?: CollageItem[];
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

// 带白边 + 投影的相片卡
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#fff";
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  const pad = 6;
  ctx.save();
  roundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, Math.max(2, r - 3));
  ctx.clip();
  drawCover(ctx, img, x + pad, y + pad, w - pad * 2, h - pad * 2);
  ctx.restore();
}

export async function buildCollage(input: CollageInput): Promise<string> {
  const W = 760;
  const H = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 背景：场景图（虚化）或渐变纯色
  if (input.scene) {
    const s = await loadImg(input.scene);
    ctx.save();
    ctx.filter = "blur(28px) brightness(0.7)";
    drawCover(ctx, s, -50, -50, W + 100, H + 100);
    ctx.restore();
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#3b2f63");
    bg.addColorStop(1, "#1f2440");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // 暗色渐变叠层，保证文字与主体清晰
  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, "rgba(18,14,35,0.62)");
  overlay.addColorStop(0.5, "rgba(18,14,35,0.40)");
  overlay.addColorStop(1, "rgba(18,14,35,0.72)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = 'bold 46px system-ui, "PingFang SC", sans-serif';
  ctx.fillText("✨ AI 换装造型", W / 2, 84);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText("S T Y L E   L O O K   ·   搭配预览", W / 2, 116);

  const items = input.items || [];

  // 人物主图（左侧 hero）
  const px = 44;
  const py = 156;
  const pw = items.length > 0 ? 430 : 520;
  const ph = 600;
  if (input.person) {
    const p = await loadImg(input.person);
    drawPhoto(ctx, p, px + (items.length > 0 ? 0 : (W - 88 - pw) / 2), py, pw, ph, 26);
  }

  // 单品（右侧竖排小卡 + 标签）
  if (items.length > 0) {
    const tile = 184;
    const tileX = px + 430 + 30 + ((W - (px + 430 + 30) - 44 - tile) / 2);
    let iy = py + 20;
    const step = tile + 58;
    for (const it of items) {
      const im = await loadImg(it.url);
      drawPhoto(ctx, im, tileX, iy, tile, tile, 18);
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(it.label, tileX + tile / 2, iy + tile + 34);
      iy += step;
    }
  }

  // 底部提示
  ctx.textAlign = "center";
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("🎬 真实换装视频生成中，请稍候…", W / 2, H - 32);

  return canvas.toDataURL("image/jpeg", 0.92);
}