// OCR runs fully in the browser with Tesseract.js. Engine, worker and English model are bundled, so it works offline.
import { createWorker, type Worker } from 'tesseract.js';
import workerSrc from 'tesseract.js/dist/worker.min.js?raw';
import coreSrc from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?raw';
import engData from '../../node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?inline';

let w: Promise<Worker> | null = null;
let progressCb: ((p: number, label: string) => void) | null = null;

async function getWorker() {
  if (!w) w = (async () => {
    // Everything the worker needs is inlined into one blob: the English model, the WASM core and the worker script.
    // That avoids importScripts/fetch of other blob URLs, which some sandboxes and file:// pages block.
    const b64 = engData.slice(engData.indexOf(',') + 1);
    const prefix = `const __b64=${JSON.stringify(b64)};const __f=self.fetch?self.fetch.bind(self):null;
self.fetch=(u,o)=>{if(String(u).indexOf('eng.traineddata')>=0){const s=atob(__b64);const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return Promise.resolve(new Response(a,{status:200}));}return __f(u,o);};\n`;
    const wk = URL.createObjectURL(new Blob([prefix, coreSrc, ';\n', workerSrc], { type: 'text/javascript' }));
    return createWorker('eng', 1, {
      workerPath: wk, corePath: 'inline-core.js', langPath: 'https://ocr.local/tessdata', workerBlobURL: false, cacheMethod: 'none', gzip: true,
      logger: (m: { status: string; progress: number }) => progressCb?.(m.progress, m.status),
    });
  })();
  return w;
}

export async function ocrImage(img: HTMLCanvasElement | Blob, onProgress?: (p: number, label: string) => void) {
  progressCb = onProgress || null;
  const worker = await getWorker();
  const r = await worker.recognize(img);
  progressCb = null;
  return { text: r.data.text, confidence: Math.round(r.data.confidence) };
}
