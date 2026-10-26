import { useMemo, useState } from 'react';
import MAP from '../lib/indiaMap.json';
import type { Region } from '../lib/types';

// Which AICTE Regional Office covers each state on the map
export const STATE_RO: Record<string, Region> = {
  Delhi: 'Northern', 'Uttar Pradesh': 'Northern', Uttarakhand: 'Northern', Bihar: 'Northern',
  Punjab: 'North-West', Haryana: 'North-West', Rajasthan: 'North-West', 'Himachal Pradesh': 'North-West', 'Jammu and Kashmir': 'North-West', Chandigarh: 'North-West',
  Maharashtra: 'Western', Gujarat: 'Western', Goa: 'Western', 'Dadra and Nagar Haveli': 'Western', 'Daman and Diu': 'Western',
  'Madhya Pradesh': 'Central', Chhattisgarh: 'Central',
  'West Bengal': 'Eastern', Odisha: 'Eastern', Jharkhand: 'Eastern', Assam: 'Eastern', 'Arunachal Pradesh': 'Eastern', Manipur: 'Eastern', Meghalaya: 'Eastern', Mizoram: 'Eastern', Nagaland: 'Eastern', Sikkim: 'Eastern', Tripura: 'Eastern', 'Andaman and Nicobar Islands': 'Eastern',
  Telangana: 'South-Central', 'Andhra Pradesh': 'South-Central',
  'Tamil Nadu': 'Southern', Puducherry: 'Southern',
  Karnataka: 'South-West', Kerala: 'South-West', Lakshadweep: 'South-West',
};
const RO_PIN: Record<Region, string> = { Northern: 'Delhi', 'North-West': 'Chandigarh', Western: 'Mumbai', Central: 'Bhopal', Eastern: 'Kolkata', 'South-Central': 'Hyderabad', Southern: 'Chennai', 'South-West': 'Bengaluru' };
export const scoreColor = (v: number) => (v >= 92 ? '#12a150' : v >= 85 ? '#6cc58f' : v >= 75 ? '#ffb066' : '#ff7a1a');
export interface RegionStat { region: Region; score: number; open: number; crit: number; pending: number; value: string; office: string }

export default function IndiaMap({ stats, sel, onPick }: { stats: RegionStat[]; sel: Region | 'all'; onPick: (r: Region | 'all') => void }) {
  const m = MAP as unknown as { vb: string; l: { i: number; n: string; d: string; c: [number, number] }[]; pts: Record<string, [number, number]> };
  const [tip, setTip] = useState<{ x: number; y: number; r: RegionStat } | null>(null);
  const by = useMemo(() => Object.fromEntries(stats.map(s => [s.region, s])), [stats]) as Record<string, RegionStat>;
  const maxOpen = Math.max(...stats.map(s => s.open), 1);
  return (
    <div className="imap" onMouseLeave={() => setTip(null)}>
      <svg viewBox={m.vb} role="img" aria-label="Map of India coloured by Regional Office compliance score">
        {m.l.map(st => { const r = STATE_RO[st.n]; const s = r && by[r]; return <path key={st.i} d={st.d} fill={s ? scoreColor(s.score) : '#dfe5f1'} className={sel !== 'all' && r !== sel ? 'dim' : ''}
          onMouseMove={e => { if (!s) return; const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - box.left + 14, y: e.clientY - box.top + 10, r: s }); }}
          onClick={() => r && onPick(sel === r ? 'all' : r)}><title>{st.n}{r ? ` · ${r} RO` : ''}</title></path>; })}
        {stats.map(s => { const p = m.pts[RO_PIN[s.region]]; if (!p) return null; const rr = 5 + (s.open / maxOpen) * 6; return (
          <g key={s.region} className="pin" onClick={() => onPick(sel === s.region ? 'all' : s.region)} style={{ cursor: 'pointer' }}>
            {s.crit > 0 && <circle className="halo" cx={p[0]} cy={p[1]} r={rr} fill="#ef4444" />}
            <circle cx={p[0]} cy={p[1]} r={rr} fill="#0b1f66" stroke="#fff" strokeWidth="2.5" />
            <text x={p[0] + rr + 4} y={p[1] + 4}>{s.office}</text>
          </g>); })}
      </svg>
      {tip && <div className="tipbox" style={{ left: tip.x, top: tip.y }}><b>{tip.r.region} RO · {tip.r.office}</b><div className="ctip-r">Compliance score <b style={{ display: 'inline', color: scoreColor(tip.r.score) }}>{tip.r.score}%</b></div><div>{tip.r.open} open deposits · {tip.r.value}</div><div>{tip.r.pending} awaiting bank · {tip.r.crit} critical</div></div>}
    </div>
  );
}
