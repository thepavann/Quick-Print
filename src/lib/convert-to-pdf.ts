/**
 * Browser-only helpers that turn photos and Word documents into a PDF on the
 * student's phone, so the counter and print agent only ever handle PDFs.
 * Heavy libraries are loaded on demand.
 */
import type { PaperSize } from "./print-config";

export type ImageLayoutId = "1" | "2" | "4" | "6" | "9" | "passport-8" | "passport-12";
export type ImageFit = "fit" | "fill";

export const IMAGE_LAYOUTS: Array<{
  id: ImageLayoutId;
  label: string;
  hint: string;
  cols: number;
  rows: number;
  passport?: boolean;
}> = [
  { id: "1", label: "1 per page", hint: "Full page", cols: 1, rows: 1 },
  { id: "2", label: "2 per page", hint: "Half page", cols: 1, rows: 2 },
  { id: "4", label: "4 per page", hint: "Quarter page", cols: 2, rows: 2 },
  { id: "6", label: "6 per page", hint: "Small grid", cols: 2, rows: 3 },
  { id: "9", label: "9 per page", hint: "Contact sheet", cols: 3, rows: 3 },
  { id: "passport-8", label: "Passport × 8", hint: "35 × 45 mm, 8 of each photo", cols: 4, rows: 2, passport: true },
  { id: "passport-12", label: "Passport × 12", hint: "35 × 45 mm, 12 of each photo", cols: 4, rows: 3, passport: true },
];

const PAGE_POINTS: Record<PaperSize, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
};
const MM = 72 / 25.4;

export type FileKind = "pdf" | "image" | "docx" | "unsupported";

export function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/.test(name) || file.type.startsWith("image/"))
    return "image";
  if (name.endsWith(".docx")) return "docx";
  return "unsupported";
}

/** Decode any browser-readable image, optionally crop to an aspect ratio, and re-encode as JPEG. */
async function toJpeg(file: File, cropAspect: number | null): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (cropAspect) {
    const aspect = sw / sh;
    if (aspect > cropAspect) {
      sw = sh * cropAspect;
      sx = (bitmap.width - sw) / 2;
    } else {
      sh = sw / cropAspect;
      sy = (bitmap.height - sh) / 2;
    }
  }
  const scale = Math.min(1, 2400 / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", 0.9),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height };
}

export async function imagesToPdf(
  files: File[],
  options: { layout: ImageLayoutId; fit: ImageFit; paper: PaperSize },
): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const layout = IMAGE_LAYOUTS.find((l) => l.id === options.layout)!;
  const [pw, ph] = PAGE_POINTS[options.paper];
  const doc = await PDFDocument.create();

  let cellW: number;
  let cellH: number;
  let gap: number;
  let originX: number;
  let originY: number;
  if (layout.passport) {
    cellW = 35 * MM;
    cellH = 45 * MM;
    gap = 4 * MM;
    originX = 10 * MM;
    originY = 10 * MM;
  } else {
    const margin = 10 * MM;
    gap = layout.cols * layout.rows > 1 ? 5 * MM : 0;
    cellW = (pw - margin * 2 - gap * (layout.cols - 1)) / layout.cols;
    cellH = (ph - margin * 2 - gap * (layout.rows - 1)) / layout.rows;
    originX = margin;
    originY = margin;
  }

  // Passport layouts repeat each photo to fill its own sheet; grids flow photos across pages.
  const slots: File[] = layout.passport
    ? files.flatMap((f) => Array.from({ length: layout.cols * layout.rows }, () => f))
    : files;
  const perPage = layout.cols * layout.rows;
  const cache = new Map<File, Awaited<ReturnType<typeof toJpeg>>>();
  const passportFill = layout.passport ? true : options.fit === "fill";

  for (let start = 0; start < slots.length; start += perPage) {
    const page = doc.addPage([pw, ph]);
    const chunk = slots.slice(start, start + perPage);
    for (let i = 0; i < chunk.length; i += 1) {
      const file = chunk[i]!;
      let img = cache.get(file);
      if (!img) {
        img = await toJpeg(file, passportFill ? cellW / cellH : null);
        cache.set(file, img);
      }
      const embedded = await doc.embedJpg(img.bytes);
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const x = originX + col * (cellW + gap);
      const yTop = ph - originY - row * (cellH + gap);
      let w = cellW;
      let h = cellH;
      if (!passportFill) {
        const s = Math.min(cellW / img.w, cellH / img.h);
        w = img.w * s;
        h = img.h * s;
      }
      page.drawImage(embedded, {
        x: x + (cellW - w) / 2,
        y: yTop - cellH + (cellH - h) / 2,
        width: w,
        height: h,
      });
    }
  }

  const bytes = await doc.save();
  const base = files.length === 1 ? files[0]!.name.replace(/\.[^.]+$/, "") : `${files.length}-photos`;
  return new File([bytes as BlobPart], `${base}.pdf`, { type: "application/pdf" });
}

/** Converts a .docx into a PDF by laying it out as A4 pages in the browser. */
export async function docxToPdf(file: File, paper: PaperSize): Promise<File> {
  const [mammoth, { default: html2canvas }, { PDFDocument }] = await Promise.all([
    import("mammoth"),
    import("html2canvas"),
    import("pdf-lib"),
  ]);
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });

  const pageWidthPx = 794; // A4 at 96 dpi
  const pageHeightPx = Math.round(pageWidthPx * Math.SQRT2);
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageWidthPx}px;padding:72px;box-sizing:border-box;background:#fff;color:#000;font-family:Calibri,Arial,sans-serif;font-size:14.5px;line-height:1.5;`;
  host.innerHTML = `<style>
    img{max-width:100%;height:auto} table{border-collapse:collapse;width:100%} td,th{border:1px solid #999;padding:4px 6px;vertical-align:top}
    h1{font-size:26px;margin:0 0 12px} h2{font-size:21px;margin:18px 0 10px} h3{font-size:17px;margin:14px 0 8px} p{margin:0 0 10px}
  </style>${html}`;
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const [pw, ph] = PAGE_POINTS[paper];
    const doc = await PDFDocument.create();
    const sliceH = pageHeightPx * 2;
    for (let top = 0; top < canvas.height; top += sliceH) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, top, canvas.width, Math.min(sliceH, canvas.height - top), 0, 0, canvas.width, Math.min(sliceH, canvas.height - top));
      const blob = await new Promise<Blob>((resolve, reject) =>
        slice.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/jpeg", 0.88),
      );
      const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const page = doc.addPage([pw, ph]);
      page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    }
    const bytes = await doc.save();
    return new File([bytes as BlobPart], file.name.replace(/\.docx$/i, ".pdf"), { type: "application/pdf" });
  } finally {
    host.remove();
  }
}
