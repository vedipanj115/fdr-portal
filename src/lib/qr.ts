import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import type { Deposit } from './types';

export const stickerCode = (d: Deposit) => `SDFP1|${d.id}|${d.number}|${d.custody?.locker || ''}|${d.hashStored.slice(0, 12)}`;
export function qrDataUrl(text: string, cell = 5) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(cell, 2) as string; }
export function decodeFrom(src: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas'); const k = Math.min(1, 900 / Math.max(w, h)); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  return r ? r.data : null;
}
export function parseSticker(text: string) { const p = text.split('|'); return p[0] === 'SDFP1' ? { id: p[1], number: p[2], locker: p[3], h: p[4] } : null; }
