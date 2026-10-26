import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useApp } from '../../lib/store';
import { LIFE, effMaturity, flagsOf, life, today, type Life } from '../../lib/rules';
import { BANKS, REGIONS } from '../../lib/data';
import { canDownload, diffDays, download, fmtDate, inr } from '../../lib/util';
import { Chips, LifeDot, PageHead, Pager, Panel, VerifBadge } from '../../components/ui';

export function toCsv(rows: (string | number)[][]) { return rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n'); }

export default function Register() {
  const { s, nav, route, toast } = useApp();
  const t = today(s);
  const [q, setQ] = useState(''); const [lf, setLf] = useState<Life | 'all'>('all');
  const [reg, setReg] = useState('all'); const [bank, setBank] = useState('all'); const [kind, setKind] = useState('all'); const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { const id = route.id || ''; if (id.startsWith('life:')) setLf(id.slice(5) as Life); if (id.startsWith('region:')) setReg(id.slice(7)); }, [route.id]);
  const rows = useMemo(() => s.deposits.map(d => ({ d, inst: s.institutions.find(i => i.id === d.instId)!, l: life(d, s, t), f: flagsOf(d, s, t) })), [s, t]);
  const counts = useMemo(() => Object.fromEntries(LIFE.map(l => [l, rows.filter(r => r.l === l).length])), [rows]);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter(r => (lf === 'all' || r.l === lf) && (reg === 'all' || r.inst.region === reg) && (bank === 'all' || r.d.bankCode === bank) && (kind === 'all' || r.d.kind === kind) && (!flagged || r.f.some(f => f.sev !== 'info'))
      && (!k || r.d.number.toLowerCase().includes(k) || r.d.id.toLowerCase().includes(k) || r.inst.name.toLowerCase().includes(k) || r.inst.city.toLowerCase().includes(k) || r.d.bankName.toLowerCase().includes(k)))
      .sort((a, b) => effMaturity(a.d).localeCompare(effMaturity(b.d)));
  }, [rows, q, lf, reg, bank, kind, flagged]);
  useEffect(() => setPage(0), [q, lf, reg, bank, kind, flagged]);
  const per = 20; const view = list.slice(page * per, page * per + per);
  const exportCsv = () => {
    const csv = toCsv([['Deposit ID', 'Institution', 'AICTE ID', 'Region', 'Type', 'Number', 'Bank', 'Amount (lakh)', 'Issue', 'Maturity', 'Verification', 'Status', 'Flags'], ...list.map(r => [r.d.id, r.inst.name, r.inst.aicteId, r.inst.region, r.d.kind, r.d.number, r.d.bankName, r.d.claimed.amountLakh, r.d.claimed.issue, r.d.claimed.maturity, r.d.verification, r.l, r.f.map(f => f.title).join('; ')])]);
    if (canDownload()) download('sdfp-register.csv', new Blob([csv], { type: 'text/csv' })); else toast('Downloads are blocked in this preview. Open the standalone file to download the CSV.', 'info');
  };
  return (
    <>
      <PageHead title="Deposit register" sub="Institution-wise and instrument-wise record of every security deposit and FDR" crumbs={[{ label: 'Records' }, { label: 'Deposit register' }]} actions={<button className="btn" onClick={exportCsv}><Download aria-hidden />Export CSV</button>} />
      <Panel flush title={<span>{list.length} instruments</span>} sub="Sorted by maturity date"
        actions={<div className="row">
          <div className="search" style={{ width: 280 }}><Search aria-hidden /><input className="input" placeholder="Institution, number, city, bank" value={q} onChange={e => setQ(e.target.value)} aria-label="Search register" /></div>
          <select className="input" style={{ width: 'auto' }} value={reg} onChange={e => setReg(e.target.value)} aria-label="Region"><option value="all">All regions</option>{REGIONS.map(r => <option key={r.name}>{r.name}</option>)}</select>
          <select className="input" style={{ width: 'auto' }} value={bank} onChange={e => setBank(e.target.value)} aria-label="Bank"><option value="all">All banks</option><option value="AICTE">Online (payment gateway)</option>{Object.entries(BANKS).map(([c, b]) => <option key={c} value={c}>{b.name}</option>)}</select>
          <select className="input" style={{ width: 'auto' }} value={kind} onChange={e => setKind(e.target.value)} aria-label="Type"><option value="all">FDR and online</option><option value="FDR">FDR only</option><option value="Online">Online only</option></select>
          <label className="check" style={{ fontSize: '.929rem' }}><input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />Needs action</label>
        </div>}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}><Chips value={lf} onChange={setLf} items={[{ id: 'all', label: 'All', count: rows.length }, ...LIFE.map(l => ({ id: l, label: l, count: counts[l] }))]} /></div>
        <div className="tw"><table className="t">
          <thead><tr><th>Deposit</th><th>Institution</th><th>Instrument</th><th className="r">Amount</th><th>Maturity</th><th>Verification</th><th>Status</th><th>Issues</th></tr></thead>
          <tbody>{view.map(({ d, inst, l, f }) => {
            const left = diffDays(effMaturity(d), t); const issues = f.filter(x => x.sev !== 'info');
            return <tr key={d.id} className="click" onClick={() => nav('deposit', d.id)}>
              <td><div className="mono nm">{d.id}</div><div className="s2">{d.kind === 'FDR' ? 'FDR' : 'Online'}</div></td>
              <td><div className="nm">{inst.name}</div><div className="s2">{inst.city} · {inst.region}</div></td>
              <td><div className="mono">{d.number}</div><div className="s2">{d.bankName}</div></td>
              <td className="r">{inr(d.claimed.amountLakh)}</td>
              <td className="nowrap"><div>{fmtDate(effMaturity(d))}</div><div className="s2">{l === 'Released' || l === 'Renewed' ? '—' : left >= 0 ? `${left} days left` : `${-left} days ago`}</div></td>
              <td><VerifBadge v={d.verification} /></td>
              <td><LifeDot l={l} /></td>
              <td>{issues.length ? <span style={{ color: issues.some(x => x.sev === 'critical') ? 'var(--bad)' : 'var(--warn)', fontWeight: 500 }}>{issues[0].title}{issues.length > 1 && ` +${issues.length - 1}`}</span> : <span className="faint">None</span>}</td>
            </tr>;
          })}</tbody></table>
          {!view.length && <div className="empty">No deposits match these filters.</div>}</div>
        <Pager page={page} pages={Math.ceil(list.length / per)} total={list.length} onPage={setPage} />
      </Panel>
    </>
  );
}
