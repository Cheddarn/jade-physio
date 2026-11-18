"use client";

import { store } from "./store";
import type { ReportOptions } from "./types";

/*
  A physio's signature for the report, from a photo of it on paper. The photo is turned into a clean digital
  signature in the browser: the paper (and its shadows) becomes transparent, the ink one even colour with smooth
  edges, specks and the photo's dark edges are dropped, and the result is cropped to the ink and sized to fit the
  signature space on the report. Kept in reportOptions/{staffId} as a small PNG. Same file in both apps.
*/

export const INK = {
  hitam: { label: "Hitam", rgb: [17, 24, 39] as const },
  biru: { label: "Biru", rgb: [29, 60, 143] as const },
};
export type InkColor = keyof typeof INK;

/** The biggest the stored signature gets, in pixels (the report shows it about 200 x 64 px). */
const OUT_W = 720;
const OUT_H = 240;
/** Photos are worked on at this size at most. */
const WORK = 1400;

type Picture = { src: CanvasImageSource; width: number; height: number };

/**
 * The photo, upright (as the phone shows it). Very large photos that a phone can't open whole are opened already
 * shrunk, straight from the file.
 */
async function loadImage(file: Blob): Promise<Picture> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (img.naturalWidth && img.naturalHeight) return { src: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    /* too big to open whole, or a format the image element won't take: try again below */
  } finally {
    // The decoded image stays usable after the URL is revoked.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  if (typeof createImageBitmap !== "function") throw new Error("decode");
  // Only the width is given, so the height keeps the photo's proportions.
  const bmp = await createImageBitmap(file, { resizeWidth: WORK, resizeQuality: "high", imageOrientation: "from-image" });
  return { src: bmp, width: bmp.width, height: bmp.height };
}

/** Running maximum over a window of 2r+1, along rows then columns: the paper's brightness with the ink taken out. */
function maxFilter(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      const a = Math.max(0, x - r),
        b = Math.min(w - 1, x + r);
      for (let i = a; i <= b; i++) if (src[row + i] > m) m = src[row + i];
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      const a = Math.max(0, y - r),
        b = Math.min(h - 1, y + r);
      for (let i = a; i <= b; i++) if (tmp[i * w + x] > m) m = tmp[i * w + x];
      out[y * w + x] = m;
    }
  }
  return out;
}

/** Box blur of radius r with an integral image. */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      s += src[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1);
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/**
 * Where the sheet of paper is, when the photo shows a table around it. Worked out on the photo with the ink taken
 * out (`bare`, the max filter): the largest bright area, pulled in from its edge past where the table meets the
 * paper. When there's no table (a close-up, a cropped or digital signature, a shadow across the paper) it is simply
 * the whole photo.
 */
function paperArea(bare: Float32Array, w: number, h: number, grown: number) {
  const all = () => new Uint8Array(w * h).fill(1);
  const long = Math.max(w, h);
  const t = otsu(bare);
  let sb = 0,
    nb = 0,
    sd = 0,
    nd = 0;
  for (const v of bare)
    if (v > t) {
      sb += v;
      nb++;
    } else {
      sd += v;
      nd++;
    }
  // No table: nothing clearly darker than the paper, or too little of it.
  if (!nb || !nd || sb / nb - sd / nd < 45 || nd < w * h * 0.08) return all();

  // The largest bright patch (4 neighbours).
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < bright.length; i++) bright[i] = bare[i] > t ? 1 : 0;
  const lab = new Int32Array(w * h).fill(-1);
  let best = -1,
    bestArea = 0;
  const stack: number[] = [];
  const step = (q: number, ok: (n: number) => boolean, mark: (n: number) => void) => {
    const x = q % w;
    for (const n of [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1])
      if (n >= 0 && n < w * h && ok(n)) {
        mark(n);
        stack.push(n);
      }
  };
  for (let p = 0, id = 0; p < w * h; p++, id++) {
    if (!bright[p] || lab[p] >= 0) continue;
    let area = 0;
    lab[p] = id;
    stack.push(p);
    while (stack.length) {
      area++;
      step(stack.pop()!, (n) => !!bright[n] && lab[n] < 0, (n) => (lab[n] = id));
    }
    if (area > bestArea) {
      bestArea = area;
      best = id;
    }
  }

  // The table: what isn't that patch and can be reached from the photo's border (holes in the sheet stay paper).
  const outside = new Uint8Array(w * h);
  const seed = (i: number) => {
    if (lab[i] !== best && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) step(stack.pop()!, (n) => lab[n] !== best && !outside[n], (n) => (outside[n] = 1));
  let outsideArea = 0;
  for (const v of outside) outsideArea += v;
  if (outsideArea < w * h * 0.08) return all();

  // A real table has a sharp edge where the paper starts; a shadow fades.
  const edges: number[] = [];
  let seen = 0;
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (outside[i] || !(outside[i - 1] || outside[i + 1] || outside[i - w] || outside[i + w])) continue;
      if (seen++ % 3) continue;
      let m = 0;
      for (let d = -3; d <= 3; d++) {
        m = Math.max(m, Math.abs(bare[i + d + 1] - bare[i + d - 1]) || 0, Math.abs(bare[i + (d + 1) * w] - bare[i + (d - 1) * w]) || 0);
      }
      edges.push(m);
    }
  edges.sort((a, b) => a - b);
  if (!edges.length || edges[edges.length >> 1] < 20) return all();

  // Pulled in from the edge: the max filter grew the paper by `grown`, and a little more covers the line where the
  // table meets the paper. Beyond the photo counts as paper.
  const r = grown + Math.max(3, Math.round(long / 150));
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += outside[y * w + x] ? 0 : 1;
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const inside = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1);
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      inside[y * w + x] = sum >= (y1 - y0) * (x1 - x0) - 0.5 ? 1 : 0;
    }
  }
  return inside;
}

/** Otsu's threshold on 0..255 values: the split that best separates ink from paper. */
function otsu(values: Float32Array) {
  const hist = new Float64Array(256);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0,
    sumB = 0,
    best = 0,
    t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB,
      mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

/** Connected groups of ink pixels (8 neighbours): a label per pixel, and each group's size and bounds. */
function components(mask: Uint8Array, w: number, h: number, margin: number, paper: Uint8Array) {
  const label = new Int32Array(w * h).fill(-1);
  // rim: pixels lying along the photo's border, where shadows, the paper's edge and the table show.
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number; edge: boolean; rim: number; onPaper: number }[] = [];
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || label[p] >= 0) continue;
    const id = comps.length;
    const c = { area: 0, x0: w, y0: h, x1: 0, y1: 0, edge: false, rim: 0, onPaper: 0 };
    label[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % w,
        y = (q - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) c.edge = true;
      if (x < margin || y < margin || x >= w - margin || y >= h - margin) c.rim++;
      if (paper[q]) c.onPaper++;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (mask[n] && label[n] < 0) {
            label[n] = id;
            stack.push(n);
          }
        }
    }
    comps.push(c);
  }
  return { label, comps };
}

export interface CleanSignature {
  /** PNG with a transparent background. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Turn a photo of a signature into a clean, cropped, transparent PNG in one ink colour. `turns`: quarter turns
 * clockwise, for a photo taken sideways or upside down.
 */
export async function cleanSignature(file: Blob, color: InkColor = "hitam", turns = 0): Promise<CleanSignature> {
  const img = await loadImage(file);
  const scale = Math.min(1, WORK / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const q = ((turns % 4) + 4) % 4;
  const w = q % 2 ? sh : sw;
  const h = q % 2 ? sw : sh;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // On white, so a signature image that is already transparent reads as ink on paper.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(img.src, -sw / 2, -sh / 2, sw, sh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;

  // Brightness, lightly smoothed so paper grain does not read as ink.
  const gray0 = new Float32Array(w * h);
  for (let i = 0, p = 0; i < gray0.length; i++, p += 4) gray0[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
  const gray = boxBlur(gray0, w, h, 1);

  // The paper's own brightness at each point (shadows and uneven light included): ink removed by a max filter wider
  // than a pen stroke, then smoothed. Ink is what is clearly darker than the paper around it.
  const long = Math.max(w, h);
  const grow = Math.max(4, Math.round(long / 90));
  const bare = maxFilter(gray, w, h, grow);
  const paper = boxBlur(bare, w, h, Math.max(6, Math.round(long / 60)));
  const dark = new Float32Array(w * h);
  for (let i = 0; i < dark.length; i++) dark[i] = Math.max(0, paper[i] - gray[i]);
  const t = Math.min(90, Math.max(22, otsu(dark)));

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = dark[i] > t ? 1 : 0;
  const margin = Math.max(3, Math.round(Math.min(w, h) * 0.02));
  const { label, comps } = components(mask, w, h, margin, paperArea(bare, w, h, grow));

  // What touches the photo's edge is the frame, not the signature, when it runs along the border (shadow, the
  // paper's edge) or is a big solid patch (the table): a signature cropped tight against the edge still counts.
  // So is anything off the sheet of paper: the table, a thumb, the line where the paper meets the table.
  const frame = comps.map(
    (c) =>
      c.onPaper / c.area < 0.5 ||
      (c.edge &&
        (c.rim / c.area > 0.4 || (c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) > 0.35 && (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1) > w * h * 0.08))),
  );

  // Strokes: the larger groups that aren't frame. Small marks (a dot, a short stroke) stay only when they sit within
  // or right beside the signature; specks further out are dirt.
  const inner = comps.filter((_, i) => !frame[i]);
  const largest = Math.max(0, ...inner.map((c) => c.area));
  if (!largest) throw new Error("Tanda tangan tidak terbaca. Foto lebih dekat, dengan cahaya terang dan latar kertas polos.");
  const minMain = Math.max(12, largest * 0.02);
  const main = inner.filter((c) => c.area >= minMain);
  let x0 = Math.min(...main.map((c) => c.x0)),
    y0 = Math.min(...main.map((c) => c.y0)),
    x1 = Math.max(...main.map((c) => c.x1)),
    y1 = Math.max(...main.map((c) => c.y1));
  const near = Math.hypot(x1 - x0, y1 - y0) * 0.05;
  const keep = new Uint8Array(comps.length);
  comps.forEach((c, i) => {
    if (frame[i]) return;
    if (c.area >= minMain) keep[i] = 1;
    else if (c.area >= 4 && c.x0 >= x0 - near && c.x1 <= x1 + near && c.y0 >= y0 - near && c.y1 <= y1 + near) keep[i] = 1;
  });
  for (let i = 0; i < comps.length; i++)
    if (keep[i]) {
      x0 = Math.min(x0, comps[i].x0);
      y0 = Math.min(y0, comps[i].y0);
      x1 = Math.max(x1, comps[i].x1);
      y1 = Math.max(y1, comps[i].y1);
    }

  // Ink kept: the strokes plus a pixel around them, for their soft edges.
  const near1 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const l = label[y * w + x];
      if (l < 0 || !keep[l]) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) near1[ny * w + nx] = 1;
        }
    }

  // One even ink colour; opacity from how dark the pixel is, firmed up so strokes look solid, edges stay smooth.
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04) + 2;
  const cx0 = Math.max(0, x0 - pad),
    cy0 = Math.max(0, y0 - pad),
    cx1 = Math.min(w - 1, x1 + pad),
    cy1 = Math.min(h - 1, y1 + pad);
  const cw = cx1 - cx0 + 1,
    ch = cy1 - cy0 + 1;
  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  const cctx = crop.getContext("2d")!;
  const out = cctx.createImageData(cw, ch);
  const [r, g, b] = INK[color].rgb;
  const lo = t * 0.45,
    hi = t * 1.35;
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const i = (y + cy0) * w + (x + cx0);
      const o = (y * cw + x) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      if (!near1[i]) continue;
      const a = Math.min(1, Math.max(0, (dark[i] - lo) / (hi - lo)));
      out.data[o + 3] = Math.round(255 * Math.pow(a, 0.6));
    }
  cctx.putImageData(out, 0, 0);

  // Sized to fit the signature space, never enlarged past the photo's own detail.
  const fit = Math.min(1, OUT_W / cw, OUT_H / ch);
  const fw = Math.max(1, Math.round(cw * fit)),
    fh = Math.max(1, Math.round(ch * fit));
  const final = document.createElement("canvas");
  final.width = fw;
  final.height = fh;
  const fctx = final.getContext("2d")!;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(crop, 0, 0, fw, fh);
  let dataUrl = final.toDataURL("image/png");
  // Kept small (it is stored with the physio's settings): a busy photo is shrunk until it fits.
  let sw2 = fw,
    sh2 = fh;
  while (dataUrl.length > 450_000 && sw2 > 240) {
    sw2 = Math.round(sw2 * 0.75);
    sh2 = Math.max(1, Math.round(sh2 * 0.75));
    const smaller = document.createElement("canvas");
    smaller.width = sw2;
    smaller.height = sh2;
    const sctx = smaller.getContext("2d")!;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(final, 0, 0, sw2, sh2);
    dataUrl = smaller.toDataURL("image/png");
  }
  return { dataUrl, width: sw2, height: sh2 };
}

/**
 * Save (or with null, remove) a physio's signature, keeping their quick-pick phrases. No read first, so it works on a
 * patchy connection: the field is updated in place, and the document is created when the physio has none yet.
 */
export async function saveSignature(staffId: string, dataUrl: string | null) {
  const patch = { signature: dataUrl, signatureAt: Date.now() };
  try {
    await store.update("reportOptions", staffId, patch);
  } catch (e) {
    const why = `${(e as { code?: string })?.code ?? ""} ${(e as Error)?.message ?? ""}`;
    if (!/not-found|no document|tidak ditemukan/i.test(why)) throw e;
    await store.set("reportOptions", staffId, { treatments: [], advice: [], updatedAt: 0, ...patch } satisfies ReportOptions);
  }
}
