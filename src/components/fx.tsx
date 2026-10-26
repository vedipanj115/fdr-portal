import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/* Numbers that count up when they first appear */
export function CountUp({ value, dur = 1100, decimals }: { value: number; dur?: number; decimals?: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(value); return; }
    const start = performance.now(), a = from.current; let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - start) / dur); const e = 1 - Math.pow(1 - k, 3); setV(a + (value - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  return <>{v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}</>;
}
/* Count up the leading number inside text such as "₹104 cr" or "86" */
export function CountText({ text }: { text: string }) {
  const m = String(text).match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return <>{text}</>;
  const n = +m[2].replace(/,/g, ''); const dec = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  return <>{m[1]}<CountUp value={n} decimals={dec} />{m[3]}</>;
}

/* Gentle 3D tilt that follows the pointer */
export function useTilt<T extends HTMLElement>(max = 7) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`); el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`); el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`); };
    const leave = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [max]);
  return ref;
}
export function Tilt({ children, className = '', max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useTilt<HTMLDivElement>(max);
  return <div ref={ref} className={`tilt ${className}`}>{children}</div>;
}

/* Reveal on scroll */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (reduced() || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el); const t = setTimeout(() => setOn(true), 2500); return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return <div ref={ref} className={`reveal ${on ? 'on' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* Animated success tick */
export function SuccessTick({ size = 72 }: { size?: number }) {
  return (
    <svg className="stick" width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="32" fill="none" stroke="var(--good)" strokeWidth="5" className="c" />
      <path d="M22 37 l10 10 l19 -21" fill="none" stroke="var(--good)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="k" />
    </svg>
  );
}

/* Live pipeline flowchart with data packets moving between stages */
export interface Stage { label: string; sub: string; count: number | string; icon: LucideIcon; color: string; onClick?: () => void }
export function Pipeline({ stages, dark }: { stages: Stage[]; dark?: boolean }) {
  const W = 1000, H = 190, n = stages.length, gap = W / n, cy = 62;
  const xs = stages.map((_, i) => gap * i + gap / 2);
  return (
    <div className={`pipe ${dark ? 'dark' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="pipe-svg">
        <defs>
          <linearGradient id="pipeg" x1="0" x2="1"><stop offset="0" stopColor="#2f6bff" /><stop offset=".55" stopColor="#7c4dff" /><stop offset="1" stopColor="#12a150" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {xs.slice(0, -1).map((x, i) => {
          const x2 = xs[i + 1]; const d = `M${x + 38},${cy} C${x + gap / 2},${cy - 34} ${x2 - gap / 2},${cy + 34} ${x2 - 38},${cy}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={dark ? 'rgba(255,255,255,.18)' : '#dfe6f5'} strokeWidth="6" strokeLinecap="round" />
              <path d={d} fill="none" stroke="url(#pipeg)" strokeWidth="3" strokeLinecap="round" className="flowline" />
              {[0, 1, 2].map(k => <circle key={k} r="5" fill={stages[i + 1].color} filter="url(#glow)"><animateMotion dur="2.6s" begin={`${k * 0.87 + i * 0.3}s`} repeatCount="indefinite" path={d} /></circle>)}
            </g>
          );
        })}
      </svg>
      <div className="pipe-nodes" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => (
          <button key={s.label} className="pnode" onClick={s.onClick} disabled={!s.onClick} style={{ ['--pc' as string]: s.color, animationDelay: `${i * 120}ms` }}>
            <span className="pring"><span className="pic"><s.icon aria-hidden /></span></span>
            <b className="pcount">{typeof s.count === 'number' ? <CountUp value={s.count} /> : s.count}</b>
            <span className="plabel">{s.label}</span>
            <small>{s.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* One listener tilts any card under the pointer: KPI cards, deposit cards, feature cards */
const TILT_SEL = '.dcard, .kx, .fcard, .lbox-tilt';
export function useGlobalTilt() {
  useEffect(() => {
    if (reduced()) return;
    let cur: HTMLElement | null = null;
    const reset = (el: HTMLElement | null) => { if (el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); } };
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(TILT_SEL) as HTMLElement | null;
      if (el !== cur) { reset(cur); cur = el; }
      if (!el) return;
      const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      const max = el.classList.contains('dcard') ? 6 : 8;
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`); el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    };
    const out = () => { reset(cur); cur = null; };
    document.addEventListener('pointermove', move); document.addEventListener('pointerleave', out);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', out); };
  }, []);
}
