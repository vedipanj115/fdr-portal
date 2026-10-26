// Unsupervised anomaly detection (Isolation Forest). No labelled fraud data is needed:
// the model learns what normal deposits look like and scores how easily each one is isolated.
import type { AppState, Deposit } from './types';
import { BANKS } from './data';
import { diffDays, rng } from './util';

export const FEATURES = ['Amount vs required', 'Term vs 10 years', 'Branch outside college city', 'Days to submit after issue', 'Bank reply time', 'Re-uploads and notes'] as const;

function vector(d: Deposit, s: AppState): number[] {
  const inst = s.institutions.find(i => i.id === d.instId)!;
  const term = diffDays(d.claimed.maturity, d.claimed.issue) / 365.25;
  const reply = d.confirmed && d.requestedOn ? Math.max(0, diffDays(d.confirmed.on, d.requestedOn)) : (BANKS[d.bankCode]?.slow || 1) * 6;
  return [
    d.claimed.amountLakh / Math.max(1, inst.requiredLakh),
    Math.abs(term - 10),
    d.kind === 'FDR' && !d.branch.toLowerCase().startsWith(inst.city.toLowerCase()) ? 1 : 0,
    Math.max(0, diffDays(d.submittedOn, d.claimed.issue)),
    reply,
    d.docs.length + d.notes.length,
  ];
}

interface Node { f?: number; v?: number; l?: Node; r?: Node; size?: number }
const c = (n: number) => (n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n);

export function anomalyScores(s: AppState, trees = 100, sample = 64) {
  const deps = s.deposits.filter(d => d.kind === 'FDR');
  if (deps.length < 10) return new Map<string, { score: number; reasons: string[] }>();
  const X = deps.map(d => vector(d, s));
  const R = rng(4242);
  const maxDepth = Math.ceil(Math.log2(sample));
  const build = (rows: number[][], depth: number): Node => {
    if (depth >= maxDepth || rows.length <= 1) return { size: rows.length };
    const f = R.int(0, rows[0].length - 1); const vals = rows.map(r => r[f]); const lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) return { size: rows.length };
    const v = lo + R.next() * (hi - lo);
    return { f, v, l: build(rows.filter(r => r[f] < v), depth + 1), r: build(rows.filter(r => r[f] >= v), depth + 1) };
  };
  const forest: Node[] = [];
  for (let t = 0; t < trees; t++) { const smp: number[][] = []; for (let k = 0; k < Math.min(sample, X.length); k++) smp.push(X[R.int(0, X.length - 1)]); forest.push(build(smp, 0)); }
  const path = (x: number[], n: Node, d: number): number => (n.f === undefined ? d + c(n.size || 1) : path(x, x[n.f] < n.v! ? n.l! : n.r!, d + 1));
  const cn = c(Math.min(sample, X.length));
  // feature medians for the explanation
  const med = X[0].map((_, j) => { const col = X.map(r => r[j]).sort((a, b) => a - b); return col[Math.floor(col.length / 2)]; });
  const mad = X[0].map((_, j) => { const col = X.map(r => Math.abs(r[j] - med[j])).sort((a, b) => a - b); return col[Math.floor(col.length / 2)] || 1; });
  const out = new Map<string, { score: number; reasons: string[] }>();
  deps.forEach((d, i) => {
    const avg = forest.reduce((a, n) => a + path(X[i], n, 0), 0) / forest.length;
    const score = Math.round(Math.pow(2, -avg / cn) * 100);
    const reasons = X[i].map((v, j) => ({ j, z: Math.abs(v - med[j]) / mad[j] })).filter(o => o.z > 3).sort((a, b) => b.z - a.z).slice(0, 2).map(o => FEATURES[o.j]);
    out.set(d.id, { score, reasons });
  });
  return out;
}
