import { useEffect, useMemo, useState } from 'react';
import { Search, LogOut as OutIcon, LogIn as InIcon, ScanLine } from 'lucide-react';
import { useApp, instOf } from '../../lib/store';
import { effMaturity, flagsOf, instFlags, isOpen, life, today } from '../../lib/rules';
import { REGIONS, regionOf } from '../../lib/data';
import type { Region } from '../../lib/types';
import { diffDays, fmtDate, inr, pct } from '../../lib/util';
import { qrDataUrl, stickerCode } from '../../lib/qr';
import { Badge, Chips, LifeDot, PageHead, Pager, Panel, SevBadge, VerifBadge } from '../../components/ui';

export function heldOf(s: ReturnType<typeof useApp>['s'], instId: string) {
  return s.deposits.filter(d => d.instId === instId && isOpen(d) && d.verification === 'Verified' && !(d.release && d.release.status !== 'Rejected')).reduce((a, d) => a + (d.confirmed?.amountLakh || 0), 0);
}

export function Institutions() {
  const { s, nav } = useApp(); const t = today(s);
  const [q, setQ] = useState(''); const [reg, setReg] = useState('all'); const [f, setF] = useState<'all' | 'ok' | 'short' | 'issues' | 'closed'>('all'); const [page, setPage] = useState(0);
  const rows = useMemo(() => s.institutions.map(i => { const deps = s.deposits.filter(d => d.instId === i.id && isOpen(d)); const held = heldOf(s, i.id); const issues = [...deps.flatMap(d => flagsOf(d, s, t)), ...instFlags(i, s)].filter(x => x.sev !== 'info'); return { i, deps, held, issues, cat: i.status !== 'Active' ? 'closed' : issues.some(x => x.code === 'topup') ? 'short' : issues.length ? 'issues' : 'ok' }; }), [s, t]);
  const list = rows.filter(r => (reg === 'all' || r.i.region === reg) && (f === 'all' || r.cat === f) && (!q || (r.i.name + r.i.city + r.i.aicteId).toLowerCase().includes(q.toLowerCase())));
  useEffect(() => setPage(0), [q, reg, f]);
  const per = 20; const v = list.slice(page * per, page * per + per);
  const c = (k: string) => rows.filter(r => r.cat === k).length;
  return (
    <>
      <PageHead title="Institutions" sub="Required deposit against what each institution actually holds, as confirmed by banks" crumbs={[{ label: 'Records' }, { label: 'Institutions' }]} />
      <Panel flush title={`${list.length} institutions`} actions={<div className="row"><div className="search" style={{ width: 260 }}><Search aria-hidden /><input className="input" placeholder="Name, city or AICTE ID" value={q} onChange={e => setQ(e.target.value)} aria-label="Search institutions" /></div><select className="input" style={{ width: 'auto' }} value={reg} onChange={e => setReg(e.target.value)} aria-label="Region"><option value="all">All regions</option>{REGIONS.map(r => <option key={r.name}>{r.name}</option>)}</select></div>}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}><Chips value={f} onChange={setF} items={[{ id: 'all', label: 'All', count: rows.length }, { id: 'ok', label: 'Compliant', count: c('ok') }, { id: 'issues', label: 'Has issues', count: c('issues') }, { id: 'short', label: 'Deposit shortfall', count: c('short') }, { id: 'closed', label: 'Closed or merged', count: c('closed') }]} /></div>
        <div className="tw"><table className="t"><thead><tr><th>Institution</th><th>AICTE ID</th><th>Region</th><th className="r">Required</th><th style={{ minWidth: 170 }}>Held (bank-verified)</th><th className="r">Deposits</th><th>Status</th></tr></thead>
          <tbody>{v.map(r => { const p = Math.min(100, pct(r.held, r.i.requiredLakh)); return <tr key={r.i.id} className="click" onClick={() => nav('institution', r.i.id)}>
            <td><div className="nm">{r.i.name}</div><div className="s2">{r.i.city}, {r.i.state}</div></td><td className="mono">{r.i.aicteId}</td><td>{r.i.region}</td><td className="r">{inr(r.i.requiredLakh)}</td>
            <td><div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><div className="meter" style={{ flex: 1 }}><i style={{ width: p + '%', background: p >= 100 ? 'var(--good)' : 'var(--warn)' }} /></div><span className="nowrap" style={{ fontSize: '.857rem' }}>{inr(r.held)}</span></div></td>
            <td className="r">{r.deps.length}</td>
            <td>{r.cat === 'ok' ? <Badge tone="good" icon>Compliant</Badge> : r.cat === 'closed' ? <Badge tone="neutral">{r.i.status}</Badge> : r.cat === 'short' ? <Badge tone="warn" icon>Shortfall</Badge> : <Badge tone={r.issues.some(x => x.sev === 'critical') ? 'bad' : 'warn'} icon>{r.issues[0].title}</Badge>}</td></tr>; })}</tbody></table></div>
        <Pager page={page} pages={Math.ceil(list.length / per)} total={list.length} onPage={setPage} />
      </Panel>
    </>
  );
}

export function InstitutionDetail({ id }: { id: string }) {
  const { s, nav } = useApp(); const t = today(s); const i = s.institutions.find(x => x.id === id);
  if (!i) return <div className="empty">Institution not found.</div>;
  const deps = s.deposits.filter(d => d.instId === i.id).sort((a, b) => b.claimed.issue.localeCompare(a.claimed.issue));
  const held = heldOf(s, i.id); const issues = [...deps.flatMap(d => flagsOf(d, s, t)), ...instFlags(i, s)];
  return (
    <>
      <PageHead title={i.name} crumbs={[{ label: 'Institutions', go: () => nav('institutions') }, { label: i.aicteId }]} sub={`${i.type} · ${i.city}, ${i.state} · ${i.region} Regional Office`} />
      <div className="kband k4">
        <div className="kpi"><div className="l">Required deposit</div><div className="v">{inr(i.requiredLakh)}</div><div className="c">{i.leased ? 'Doubled for a leased building' : `For ${i.type.toLowerCase()}`}</div></div>
        <div className={`kpi ${held >= i.requiredLakh ? 'good' : 'warn'}`}><div className="l">Held, bank-verified</div><div className="v">{inr(held)}</div><div className="c">{held >= i.requiredLakh ? 'Meets requirement' : `Short by ${inr(i.requiredLakh - held)}`}</div></div>
        <div className="kpi"><div className="l">Instruments</div><div className="v">{deps.filter(isOpen).length}<small>open</small></div><div className="c">{deps.length} on record including renewed and released</div></div>
        <div className={`kpi ${issues.some(f => f.sev === 'critical') ? 'bad' : ''}`}><div className="l">Open issues</div><div className="v">{issues.filter(f => f.sev !== 'info').length}</div><div className="c">{i.openComplaints ? `${i.openComplaints} student complaint(s) open` : 'No open complaints'}</div></div>
      </div>
      <div className="layout">
        <Panel className="s8" title="Instruments" flush>
          <div className="tw"><table className="t"><thead><tr><th>Instrument</th><th className="r">Amount</th><th>Issue</th><th>Maturity</th><th>Verification</th><th>Status</th></tr></thead>
            <tbody>{deps.map(d => <tr key={d.id} className="click" onClick={() => nav('deposit', d.id)}><td><div className="mono nm">{d.number}</div><div className="s2">{d.bankName}</div></td><td className="r">{inr(d.claimed.amountLakh)}</td><td>{fmtDate(d.claimed.issue)}</td><td>{fmtDate(effMaturity(d))}</td><td><VerifBadge v={d.verification} /></td><td><LifeDot l={life(d, s, t)} /></td></tr>)}</tbody></table></div>
        </Panel>
        <div className="s4 col" style={{ alignContent: 'start' }}>
          <Panel title="Profile"><dl className="kv"><dt>AICTE ID</dt><dd className="mono">{i.aicteId}</dd><dt>Established</dt><dd>{i.established}</dd><dt>Approved intake</dt><dd>{i.intake}</dd><dt>Status</dt><dd>{i.status}</dd><dt>Email</dt><dd>{i.email}</dd><dt>Phone</dt><dd>{i.phone}</dd></dl></Panel>
          <Panel title="Issues" flush><div className="list">{issues.length ? issues.map((f, k) => <button key={k} className="li" onClick={() => f.depId && nav('deposit', f.depId)}><span className={`mark ${f.sev === 'critical' ? 'bad' : f.sev === 'action' ? 'warn' : 'info'}`} /><div><div className="ttl">{f.title}</div><div className="meta">{f.detail}</div></div><SevBadge s={f.sev} /></button>) : <div className="empty">No issues.</div>}</div></Panel>
        </div>
      </div>
    </>
  );
}

export function Vault() {
  const { s, route, user, act, toast, nav } = useApp(); const t = today(s);
  const pre = route.id ? s.deposits.find(d => d.id === route.id) : undefined;
  const [reg, setReg] = useState<Region>(pre ? instOf(s, pre.instId).region : (user?.region && user.region !== 'HQ' ? user.region : 'Western'));
  const [sel, setSel] = useState<string | null>(pre?.id || null); const [why, setWhy] = useState('Bank verification visit');
  const code = regionOf(reg).code;
  const deps = s.deposits.filter(d => d.custody && d.custody.locker.startsWith(code + '-') && !d.replacedBy && !(d.release && d.release.status === 'Lien released'));
  const lockers = [...new Set(deps.map(d => d.custody!.locker))].sort();
  const cur = deps.find(d => d.id === sel) || deps.find(d => d.custody?.state === 'Checked out') || deps[0];
  const out = deps.filter(d => d.custody?.state === 'Checked out');
  const move = async (action: 'Checked out' | 'Checked in') => { if (!cur) return; if (await act('vault.move', { depId: cur.id, action, reason: why })) toast(`${cur.number} ${action.toLowerCase()}. Logged with time and officer.`); };
  const log = s.vault.filter(v => v.locker.startsWith(code + '-')).slice().reverse().slice(0, 30);
  return (
    <>
      <PageHead title="FDR vault" sub="Original paper FDRs held in Regional Office lockers, each with a QR sticker for check-in, check-out and authentication" crumbs={[{ label: 'Records' }, { label: 'FDR vault' }]}
        actions={<><select className="input" style={{ width: 'auto' }} value={reg} onChange={e => { setReg(e.target.value as Region); setSel(null); }} aria-label="Regional Office">{REGIONS.map(r => <option key={r.name} value={r.name}>{r.name} RO, {r.office}</option>)}</select><button className="btn" onClick={() => window.dispatchEvent(new Event('sdfp-scan'))}><ScanLine aria-hidden />Scan a sticker</button></>} />
      <div className="kband k4">
        <div className="kpi"><div className="l">Originals held</div><div className="v">{deps.filter(d => d.custody?.state === 'In locker').length}</div><div className="c">in {lockers.length} lockers</div></div>
        <div className={`kpi ${out.length ? 'warn' : ''}`}><div className="l">Checked out</div><div className="v">{out.length}</div><div className="c">{out.filter(d => diffDays(t, d.custody!.since) > 7).length} out for more than 7 days</div></div>
        <div className="kpi"><div className="l">In transit to RO</div><div className="v">{deps.filter(d => d.custody?.state === 'In transit to RO').length}</div><div className="c">Submitted online, paper on its way</div></div>
        <div className="kpi"><div className="l">Movements logged</div><div className="v">{s.vault.filter(v => v.locker.startsWith(code + '-')).length}</div><div className="c">Every access is recorded</div></div>
      </div>
      <div className="layout">
        <div className="s8 col" style={{ alignContent: 'start' }}>
          <Panel title="Lockers" sub="Red lockers have an original checked out"><div className="lockers">{lockers.map(l => { const here = deps.filter(d => d.custody!.locker === l); const o = here.some(d => d.custody!.state === 'Checked out'); return <button key={l} className={`locker ${o ? 'out' : ''} ${cur && cur.custody!.locker === l ? 'sel' : ''}`} onClick={() => setSel(here[0].id)}><b>{l.split('-')[1]}</b><span>{here.length} original{here.length > 1 ? 's' : ''}{o ? ' · 1 out' : ''}</span></button>; })}</div></Panel>
          <Panel title="Inventory" flush><div className="tw" style={{ maxHeight: 420, overflow: 'auto' }}><table className="t"><thead><tr><th>Locker</th><th>FDR</th><th>Institution</th><th>Custody</th><th>Since</th></tr></thead>
            <tbody>{deps.map(d => <tr key={d.id} className="click" onClick={() => setSel(d.id)} style={cur?.id === d.id ? { background: 'var(--blue-bg)' } : undefined}><td className="mono">{d.custody!.locker}</td><td className="mono">{d.number}</td><td>{instOf(s, d.instId).name}</td><td>{d.custody!.state === 'In locker' ? <Badge tone="good">In locker</Badge> : d.custody!.state === 'Checked out' ? <Badge tone="bad">Checked out</Badge> : <Badge tone="info">In transit</Badge>}</td><td>{fmtDate(d.custody!.since)}</td></tr>)}</tbody></table></div></Panel>
        </div>
        <div className="s4 col" style={{ alignContent: 'start' }}>
          {cur && <Panel title="QR sticker" sub={instOf(s, cur.instId).name}>
            <div className="qrbox"><img src={qrDataUrl(stickerCode(cur))} alt={`QR sticker for ${cur.number}`} /><b className="mono">{cur.number}</b><span className="muted" style={{ fontSize: '.857rem' }}>Locker {cur.custody!.locker} · {cur.custody!.state}{cur.custody!.reason ? ` (${cur.custody!.reason})` : ''}</span></div>
            <div className="col" style={{ marginTop: 12 }}>
              {cur.custody!.state === 'In locker' ? <><select className="input" value={why} onChange={e => setWhy(e.target.value)} aria-label="Reason"><option>Bank verification visit</option><option>Handed to bank after NOC</option><option>Audit inspection</option><option>Court requisition</option></select><button className="btn" onClick={() => move('Checked out')}><OutIcon aria-hidden />Check out</button></> : <button className="btn primary" onClick={() => move('Checked in')}><InIcon aria-hidden />{cur.custody!.state === 'In transit to RO' ? 'Receive into locker' : 'Check back in'}</button>}
              <button className="btn ghost" onClick={() => nav('deposit', cur.id)}>Open deposit record</button>
            </div>
          </Panel>}
          <Panel title="Access log" flush><div className="list" style={{ maxHeight: 380, overflow: 'auto' }}>{log.map((v, k) => <div key={k} className="li"><span className={`mark ${v.action === 'Checked out' ? 'warn' : 'good'}`} /><div><div className="ttl" style={{ fontWeight: 500, fontSize: '.929rem' }}>{v.action} · <span className="mono">{v.locker}</span></div><div className="meta">{fmtDate(v.at)} · {v.by} · {v.reason}</div></div><span /></div>)}{!log.length && <div className="empty">No movements yet.</div>}</div></Panel>
        </div>
      </div>
    </>
  );
}
