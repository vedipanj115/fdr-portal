import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?raw';
export { specimenFdrPdf, makeReport, nocPdf, table, type FdrFields } from './docgen';

let workerReady = false;
function ensureWorker() {
  if (workerReady) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }));
  workerReady = true;
}
export async function openPdf(bytes: Uint8Array) { ensureWorker(); return pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; }
export async function pdfText(bytes: Uint8Array) {
  const pdf = await openPdf(bytes); const out: string[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const pg = await pdf.getPage(p); const tc = await pg.getTextContent();
    let lastY: number | null = null; let line = '';
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { out.push(line); line = ''; }
      line += (line ? ' ' : '') + it.str; lastY = y;
    }
    out.push(line);
  }
  return out.join('\n');
}
export async function renderPdf(bytes: Uint8Array, canvas: HTMLCanvasElement, cssWidth: number, page = 1) {
  const pdf = await openPdf(bytes); const pg = await pdf.getPage(page);
  const base = pg.getViewport({ scale: 1 });
  const scale = (cssWidth / base.width) * (window.devicePixelRatio || 1);
  const vp = pg.getViewport({ scale });
  canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = cssWidth + 'px'; canvas.style.height = 'auto';
  await pg.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return pdf.numPages;
}
export async function pdfToCanvas(bytes: Uint8Array, scale = 2.2) {
  const pdf = await openPdf(bytes); const pg = await pdf.getPage(1); const vp = pg.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise; return c;
}

export interface Parsed { number: string | null; ifsc: string | null; branch: string | null; amountLakh: number | null; issue: string | null; maturity: string | null; }
export function parseFdr(raw: string, ocr = false): Parsed {
  let t = raw.replace(/\r/g, '');
  if (ocr) t = t.replace(/[|]/g, 'I').replace(/[“”]/g, '"').replace(/ {2,}/g, ' ');
  const g = (re: RegExp) => { const m = t.match(re); return m ? m[1].trim() : null; };
  const toIso = (s: string | null) => { if (!s) return null; const m = s.replace(/[Oo]/g, '0').match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
  let number = g(/FDR\s*(?:No|Number)\.?\s*[:;]?\s*([A-Z0-9O]{2}[0-9OIl]{6,})/i);
  if (number) number = number.slice(0, 2).toUpperCase() + number.slice(2).replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  let ifsc = g(/IFSC\s*(?:Code)?\s*[:;]?\s*([A-Z]{4}[0O][A-Z0-9]{6})/i);
  if (ifsc) ifsc = ifsc.slice(0, 4).toUpperCase() + '0' + ifsc.slice(5).replace(/[Oo]/g, '0').toUpperCase();
  const amt = g(/Amount\s*(?:\(.*?\))?\s*[:;]?\s*(?:Rs\.?|INR|₹)?\s*([\d,.]+)/i);
  const amountLakh = amt ? +amt.replace(/,/g, '').replace(/\.(?=.*\.)/g, '') / 1e5 : null;
  return {
    number, ifsc, branch: g(/Branch\s*[:;]?\s*([^\n]+)/i),
    amountLakh: amountLakh && isFinite(amountLakh) ? +amountLakh.toFixed(2) : null,
    issue: toIso(g(/Date of Issue\s*[:;]?\s*([0-9OIl./\- ]{8,12})/i)),
    maturity: toIso(g(/Date of Maturity\s*[:;]?\s*([0-9OIl./\- ]{8,12})/i)),
  };
}

// Simulate a phone photo of a paper FDR: rendered, slightly rotated, warm paper tone, noise.
export async function scannedPhoto(bytes: Uint8Array): Promise<Uint8Array> {
  const src = await pdfToCanvas(bytes, 1.6);
  const crop = document.createElement('canvas'); const ch = Math.round(src.height * 0.62);
  crop.width = src.width + 80; crop.height = ch + 80;
  const x = crop.getContext('2d')!;
  x.fillStyle = '#6b6258'; x.fillRect(0, 0, crop.width, crop.height);
  x.translate(crop.width / 2, crop.height / 2); x.rotate(-0.012);
  x.filter = 'sepia(0.25) contrast(0.92) brightness(0.98) blur(0.4px)';
  x.drawImage(src, 0, 0, src.width, ch, -src.width / 2, -ch / 2, src.width, ch);
  x.setTransform(1, 0, 0, 1, 0, 0); x.filter = 'none';
  const img = x.getImageData(0, 0, crop.width, crop.height);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const blob: Blob = await new Promise(r => crop.toBlob(b => r(b!), 'image/jpeg', 0.86));
  return new Uint8Array(await blob.arrayBuffer());
}

