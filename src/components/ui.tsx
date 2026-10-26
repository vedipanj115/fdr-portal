import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import type { Deposit, Verification } from '../lib/types';
import { LIFE_COLOR, type Life, type Sev } from '../lib/rules';
import { cls } from '../lib/util';
import { renderPdf } from '../lib/pdf';
import { CountText, CountUp } from './fx';
import { useApp, type OtpInfo } from '../lib/store';

export function Logo({ size = 46, light = false }: { size?: number; light?: boolean }) {
  // Original mark: a ledger page inside a shield, banded saffron / white / green. Not an official emblem.
  const ink = light ? '#ffffff' : '#0f2a52';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3 42 9.5v13.2C42 33.8 34.6 41.6 24 45 13.4 41.6 6 33.8 6 22.7V9.5z" fill={light ? 'rgba(255,255,255,.08)' : '#fff'} stroke={ink} strokeWidth="2.2" />
      <path d="M10 12.2 24 7.3l14 4.9v3.1H10z" fill="#e5801b" />
      <path d="M10 15.3h28v3H10z" fill={light ? '#fff' : '#f3f5f8'} />
      <path d="M10 18.3h28v3H10z" fill="#138a3c" />
      <rect x="16" y="24" width="16" height="13" rx="1.5" fill="none" stroke={ink} strokeWidth="2" />
      <path d="M19.5 28h9M19.5 31h9M19.5 34h5.5" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ tone = 'neutral', children, icon }: { tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral'; children: ReactNode; icon?: boolean }) {
  const I = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : tone === 'info' ? Info : Circle;
  return <span className={`badge b-${tone}`}>{icon && <I aria-hidden />}{children}</span>;
}
export const verifTone = (v: Verification) => (v === 'Verified' ? 'good' : v === 'Mismatch' || v === 'Not found' ? 'bad' : v === 'Not requested' ? 'warn' : 'info');
export const VerifBadge = ({ v }: { v: Verification }) => <Badge tone={verifTone(v)} icon>{v === 'Verified' ? 'Bank-verified' : v}</Badge>;
export const LifeDot = ({ l }: { l: Life }) => <span className="dot" style={{ ['--dc' as string]: LIFE_COLOR[l] }}>{l}</span>;
export const SevBadge = ({ s }: { s: Sev }) => <Badge tone={s === 'critical' ? 'bad' : s === 'action' ? 'warn' : 'info'} icon>{s === 'critical' ? 'Critical' : s === 'action' ? 'Action' : 'Notice'}</Badge>;

export function Panel({ title, sub, actions, children, flush, foot, className, id }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; foot?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cls('panel', className)} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {title && <div className="ph"><div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div><div className="grow" />{actions}</div>}
      <div className={cls('pb', flush && 'flush')}>{children}</div>
      {foot && <div className="pf">{foot}</div>}
    </section>
  );
}

export function PageHead({ title, sub, crumbs, actions }: { title: string; sub?: ReactNode; crumbs?: { label: string; go?: () => void }[]; actions?: ReactNode }) {
  return (
    <div className="phead">
      <div className="grow">
        {crumbs && <nav className="crumbs" aria-label="Breadcrumb">{crumbs.map((c, i) => <span key={i}>{c.go ? <button onClick={c.go}>{c.label}</button> : c.label}{i < crumbs.length - 1 && ' /'}</span>)}</nav>}
        <h1>{title}</h1>{sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Modal({ title, sub, onClose, children, foot, width = 720 }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[data-autofocus], button')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" ref={ref} style={{ ['--mw' as string]: width + 'px' }}>
        <div className="mh"><div className="grow"><h2>{title}</h2>{sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}</div><button className="iconbtn" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="mb">{children}</div>
        {foot && <div className="mf">{foot}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return <div className="tabs" role="tablist">{items.map(i => <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)}>{i.label}{i.count != null && <span className="cnt">{i.count}</span>}</button>)}</div>;
}
export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return <div className="chips">{items.map(i => <button key={i.id} className="chip" aria-pressed={value === i.id} onClick={() => onChange(i.id)}>{i.label}{i.count != null && <b>{i.count}</b>}</button>)}</div>;
}

export function Checks({ items }: { items: { ok: boolean; label: string; detail?: string }[] }) {
  return <div className="checks">{items.map((c, i) => <div key={i} className={c.ok ? 'ok' : 'no'}>{c.ok ? <CheckCircle2 aria-label="Met" /> : <XCircle aria-label="Not met" />}<div><b style={{ fontWeight: 500, color: 'var(--ink)' }}>{c.label}</b>{c.detail && <small>{c.detail}</small>}</div></div>)}</div>;
}

export function PdfView({ bytes, mime, width = 520 }: { bytes: Uint8Array; mime: string; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string>('');
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (mime.startsWith('image/')) { const u = URL.createObjectURL(new Blob([bytes], { type: mime })); setUrl(u); return () => URL.revokeObjectURL(u); }
    const w = Math.min(width, (box.current?.clientWidth || width) - 22);
    if (ref.current) renderPdf(bytes, ref.current, Math.max(200, w)).catch(() => setErr(true));
  }, [bytes, mime, width]);
  return <div className="docv" ref={box}>{err ? <div className="muted">Preview not available for this file.</div> : mime.startsWith('image/') ? (url && <img src={url} alt="Uploaded document" />) : <canvas ref={ref} />}</div>;
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="pager"><span>{total} records · page {page + 1} of {Math.max(1, pages)}</span>
      <div className="row"><button className="btn sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button></div></div>
  );
}

/** Asks the server to send an OTP (purpose + ref), or shows a code already sent (info). The code is checked by the server inside the action. */
export function OtpBox({ label = 'Enter OTP', purpose, refId, info, onOk, busyLabel = 'Verify and sign' }: { label?: string; purpose?: string; refId?: string; info?: OtpInfo; onOk: (otp: string) => Promise<string | void> | string | void; busyLabel?: string }) {
  const { requestOtp } = useApp();
  const [v, setV] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<OtpInfo | null>(info || null);
  const send = useCallback(() => { if (purpose) requestOtp(purpose, refId || '').then(setSent).catch(e => setErr((e as Error).message)); }, [purpose, refId, requestOtp]);
  useEffect(() => { if (!info) send(); }, [info, send]);
  return (
    <form className="col" onSubmit={async e => { e.preventDefault(); if (!/^\d{6}$/.test(v)) { setErr('Enter the 6-digit OTP.'); return; } setBusy(true); const r = await onOk(v.trim()); setBusy(false); if (typeof r === 'string') { setErr(r); setV(''); } }}>
      <Field label={label} hint={sent ? <>OTP sent by SMS to {sent.to}{sent.devCode && <>. Demo OTP: <b className="mono" data-otp>{sent.devCode}</b></>}{purpose && <> · <button type="button" className="link" onClick={() => { setV(''); setErr(''); send(); }}>Resend</button></>}</> : 'Sending OTP…'}>
        <input className={cls('input otp', err && 'err')} inputMode="numeric" maxLength={6} value={v} onChange={e => { setV(e.target.value.replace(/\D/g, '')); setErr(''); }} data-autofocus aria-invalid={!!err} />
      </Field>
      {err && <div className="hint bad" role="alert">{err}</div>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Checking…' : busyLabel}</button>
    </form>
  );
}

export const depTitle = (d: Deposit) => `${d.kind === 'FDR' ? 'FDR' : 'Online deposit'} ${d.number}`;

export function Spark({ data, color = 'var(--b500)', w = 92, h = 34 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const id = 'sp' + Math.abs(data.reduce((a, v) => a * 31 + v, 7) | 0);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
export function Kpi({ icon: I, color, label, value, unit, sub, spark, tone, onClick }: { icon: LucideIcon; color: string; label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; spark?: number[]; tone?: 'good' | 'warn' | 'bad'; onClick?: () => void }) {
  const body = <><div className="top"><span className="ico"><I aria-hidden /></span><span className="l">{label}</span></div><div className="v">{typeof value === 'number' ? <CountUp value={value} /> : typeof value === 'string' ? <CountText text={value} /> : value}{unit && <small>{unit}</small>}</div>{sub && <div className="c">{sub}</div>}{spark && <Spark data={spark} color={color} />}</>;
  const st = { ['--kc' as string]: color } as React.CSSProperties;
  return onClick ? <button className={`kx ${tone ? 'tone-' + tone : ''}`} style={st} onClick={onClick}>{body}</button> : <div className={`kx ${tone ? 'tone-' + tone : ''}`} style={st}>{body}</div>;
}

export function QuickActions({ items }: { items: { icon: LucideIcon; label: string; sub: string; color: string; onClick: () => void }[] }) {
  return <div className="qa">{items.map(i => <button key={i.label} onClick={i.onClick}><span className="ic" style={{ background: i.color }}><i.icon aria-hidden /></span><span><b>{i.label}</b><small>{i.sub}</small></span></button>)}</div>;
}
export function Ring({ value, color = 'var(--good)', size = 64 }: { value: number; color?: string; size?: number }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /><text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" style={{ font: '700 14px Poppins, sans-serif', fill: 'var(--ink)' }}>{Math.round(value)}%</text></svg>;
}

export function EmptyState({ icon: I, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="es"><span className="eic"><I aria-hidden /></span><b>{title}</b><p>{text}</p>{action}</div>;
}
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="sw" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}
