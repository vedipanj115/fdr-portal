// Dates are ISO strings (YYYY-MM-DD). All maths in UTC days.
export const DAY = 86400000;
export const toMs = (iso: string) => Date.parse(iso + 'T00:00:00Z');
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromMs(toMs(iso) + n * DAY);
export const addYears = (iso: string, n: number) => {
  const d = new Date(toMs(iso)); d.setUTCFullYear(d.getUTCFullYear() + n); return fromMs(d.getTime());
};
export const diffDays = (a: string, b: string) => Math.round((toMs(a) - toMs(b)) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d} ${MON[+m - 1]} ${y}`;
};
export const fmtMonth = (iso: string) => { const [y, m] = iso.split('-'); return `${MON[+m - 1]} ${y.slice(2)}`; };
export const fmtDMY = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const fmtDateTime = (ts: string) => {
  const d = new Date(ts);
  return `${fmtDate(ts.slice(0, 10))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const todayReal = () => fromMs(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));

// Money: amounts are stored in lakh rupees.
export const inr = (lakh?: number | null) => {
  if (lakh == null || isNaN(lakh)) return '—';
  if (lakh >= 100) return `₹${(lakh / 100).toFixed(lakh % 100 ? 2 : 0)} cr`;
  return `₹${+lakh.toFixed(2)} L`;
};
export const inrFull = (lakh: number) => '₹' + Math.round(lakh * 1e5).toLocaleString('en-IN');
export const inrCr = (lakh: number) => `₹${(lakh / 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })} cr`;
export const num = (n: number) => n.toLocaleString('en-IN');
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// Seeded random (mulberry32) so the demo data is the same on every load.
export function rng(seed: number) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: r,
    int: (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1)),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)],
    chance: (p: number) => r() < p,
  };
}

// Synchronous SHA-256 (used for the audit chain and document fingerprints).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const l = bytes.length, bitLen = l * 8;
  const total = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 4, bitLen >>> 0); dv.setUint32(total - 8, Math.floor(bitLen / 4294967296));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = W[t - 15], y = W[t - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8).toUpperCase();

// Downloads only work when the page is opened as a file, not inside the sandboxed viewer.
export const canDownload = () => { try { return window.top === window; } catch { return false; } };
export function download(name: string, data: Blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
