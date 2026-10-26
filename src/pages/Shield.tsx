import { useEffect, useState } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { useApp } from '../lib/store';
import { isOpen, life, today } from '../lib/rules';
import { fmtDate } from '../lib/util';
import { Badge, Panel } from '../components/ui';
import { GovChrome, GovFooter, Toasts } from '../components/Chrome';

export function shieldStatus(s: ReturnType<typeof useApp>['s'], instId: string) {
  const t = today(s); const inst = s.institutions.find(i => i.id === instId)!;
  const deps = s.deposits.filter(d => d.instId === instId && isOpen(d));
  const valid = deps.filter(d => { const l = life(d, s, t); return l === 'Active' || l === 'Expiring'; });
  const held = valid.reduce((a, d) => a + (d.confirmed?.amountLakh || 0), 0);
  if (inst.status !== 'Active') return { tone: 'neutral' as const, label: `Institution ${inst.status.toLowerCase()}`, note: 'Deposit is being settled by AICTE' };
  if (valid.length && held >= inst.requiredLakh) return { tone: 'good' as const, label: 'Security deposit valid', note: `Bank-confirmed; last checked ${fmtDate(t)}` };
  if (deps.some(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker')) return { tone: 'info' as const, label: 'Under verification', note: 'Bank confirmation in progress' };
  return { tone: 'bad' as const, label: 'Not valid right now', note: 'AICTE is following up with the institution' };
}

export default function Shield() {
  const { s, route, nav, api } = useApp(); const [q, setQ] = useState(route.id || '');
  const k = q.trim().toLowerCase();
  type Row = { id: string; name: string; city: string; state: string; aicteId: string; tone: 'good' | 'bad' | 'info' | 'neutral'; label: string; note: string };
  const [remote, setRemote] = useState<Row[]>([]);
  useEffect(() => { if (!api || k.length < 2) return; const h = setTimeout(() => { fetch('/api/public/shield?q=' + encodeURIComponent(k)).then(r => r.json()).then(setRemote).catch(() => setRemote([])); }, 220); return () => clearTimeout(h); }, [api, k]);
  const res: Row[] = k.length < 2 ? [] : api ? remote : s.institutions.filter(i => (i.name + ' ' + i.city + ' ' + i.state).toLowerCase().includes(k)).slice(0, 12).map(i => ({ ...i, ...shieldStatus(s, i.id) }));
  return (
    <div className="app">
      <GovChrome />
      <main id="main" className="in" style={{ paddingBlock: 28, width: '100%' }}>
        <button className="link" onClick={() => nav('home')}><ArrowLeft width={14} style={{ verticalAlign: -2 }} aria-hidden /> Back to sign in</button>
        <h1 style={{ font: '600 2.2rem/1.15 var(--f-cond)', margin: '10px 0 6px' }}>Check a college's security deposit</h1>
        <p className="muted" style={{ maxWidth: '62ch' }}>AICTE holds a security deposit from private technical institutions to protect students if a college closes. Search by name or city. Amounts and bank details are not shown.</p>
        <form className="row" style={{ margin: '18px 0', maxWidth: 640 }} onSubmit={e => e.preventDefault()}>
          <div className="search" style={{ flex: 1, width: 'auto' }}><Search aria-hidden /><input className="input" style={{ minHeight: 46, fontSize: '1.07rem' }} value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. Pune, or Institute of Technology" aria-label="College name or city" autoFocus /></div>
        </form>
        <Panel flush title={k.length >= 2 ? `${res.length} result${res.length === 1 ? '' : 's'}` : 'Start typing to search'}>
          <div className="list">{res.map(i => { const st = i; return <div key={i.id} className="li"><span className={`mark ${st.tone === 'good' ? 'good' : st.tone === 'bad' ? 'bad' : 'info'}`} /><div><div className="ttl">{i.name}</div><div className="meta">{i.city}, {i.state} · AICTE ID {i.aicteId} · {st.note}</div></div><Badge tone={st.tone} icon>{st.label}</Badge></div>; })}
            {k.length >= 2 && !res.length && <div className="empty">No approved institution matches. Check the spelling, or search by city.</div>}</div>
        </Panel>
      </main>
      <GovFooter /><Toasts />
    </div>
  );
}
