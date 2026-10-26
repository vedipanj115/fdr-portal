import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts';
import type { ReactNode } from 'react';

const axis = { fontSize: 12, fill: 'var(--muted)' };
type TipPayload = { name?: string; value?: number; payload?: Record<string, unknown>; color?: string; fill?: string }[];
export function Tip({ active, payload, label, fmt, title }: { active?: boolean; payload?: TipPayload; label?: string; fmt?: (p: Record<string, unknown>) => ReactNode; title?: (p: Record<string, unknown>, label?: string) => ReactNode }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload || {};
  return <div className="ctip"><b>{title ? title(p, label) : label ?? String(p.name ?? '')}</b>{fmt ? fmt(p) : <div className="r"><span>Value</span><span>{payload[0].value}</span></div>}</div>;
}

export function Donut({ data, center, sub, onPick, height = 240 }: { data: { name: string; value: number; color: string }[]; center: ReactNode; sub: string; onPick?: (n: string) => void; height?: number }) {
  return (
    <div style={{ position: 'relative', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="96%" paddingAngle={2.5} cornerRadius={7} stroke="none" isAnimationActive animationDuration={900} animationEasing="ease-out" onClick={(e: { name?: string }) => e?.name && onPick?.(e.name)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            {data.map(d => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip content={<Tip fmt={p => <div className="r"><span>Deposits</span><span>{String(p.value)}</span></div>} />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
        <div><div className="big">{center}</div><div className="muted" style={{ fontSize: '.857rem' }}>{sub}</div></div>
      </div>
    </div>
  );
}

export function Columns({ data, x, y, color, highlight, hiColor, fmtY, tip, height = 250, refY, refLabel }: { data: Record<string, unknown>[]; x: string; y: string; color: string; highlight?: (d: Record<string, unknown>) => boolean; hiColor?: string; fmtY?: (v: number) => string; tip: (p: Record<string, unknown>) => ReactNode; height?: number; refY?: number; refLabel?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-2)' }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={fmtY} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(31,86,163,.06)' }} content={<Tip fmt={tip} />} />
          {refY != null && <ReferenceLine y={refY} stroke="var(--bad)" strokeDasharray="4 3" label={{ value: refLabel, position: 'insideTopRight', fill: 'var(--bad)', fontSize: 12 }} />}
          <Bar dataKey={y} radius={[8, 8, 3, 3]} isAnimationActive animationDuration={900} animationEasing="ease-out" maxBarSize={34}>
            {data.map((d, i) => <Cell key={i} fill={highlight && highlight(d) ? hiColor : color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBars({ data, x, y, color, tip, refX, refLabel, height, fmtX }: { data: Record<string, unknown>[]; x: string; y: string; color: (d: Record<string, unknown>) => string; tip: (p: Record<string, unknown>) => ReactNode; refX?: number; refLabel?: string; height?: number; fmtX?: (v: number) => string }) {
  return (
    <div style={{ height: height ?? Math.max(160, data.length * 30 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtX} />
          <YAxis type="category" dataKey={y} tick={{ ...axis, fill: 'var(--text)' }} tickLine={false} axisLine={false} width={150} />
          <Tooltip cursor={{ fill: 'rgba(31,86,163,.06)' }} content={<Tip fmt={tip} />} />
          {refX != null && <ReferenceLine x={refX} stroke="var(--bad)" strokeDasharray="4 3" label={{ value: refLabel, position: 'top', fill: 'var(--bad)', fontSize: 12 }} />}
          <Bar dataKey={x} radius={[3, 8, 8, 3]} isAnimationActive animationDuration={900} animationEasing="ease-out" maxBarSize={16} background={{ fill: 'var(--surface-2)', radius: 8 }}>
            {data.map((d, i) => <Cell key={i} fill={color(d)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrend({ data, x, y, color = 'var(--c1)', tip, height = 200 }: { data: Record<string, unknown>[]; x: string; y: string; color?: string; tip: (p: Record<string, unknown>) => ReactNode; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-2)' }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={36} allowDecimals={false} domain={['auto', 'auto']} />
          <Tooltip content={<Tip fmt={tip} />} cursor={{ stroke: 'var(--faint)', strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey={y} stroke={color} strokeWidth={2} fill="url(#ag)" isAnimationActive animationDuration={900} animationEasing="ease-out" dot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Stack100({ parts }: { parts: { v: number; color: string; label: string }[] }) {
  const t = parts.reduce((a, p) => a + p.v, 0) || 1;
  return <div className="stack100" role="img" aria-label={parts.map(p => `${p.label} ${p.v}`).join(', ')}>{parts.filter(p => p.v > 0).map(p => <i key={p.label} title={`${p.label}: ${p.v}`} style={{ width: `${(p.v / t) * 100}%`, background: p.color }} />)}</div>;
}
