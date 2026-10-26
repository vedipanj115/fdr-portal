import { useMemo, useState } from 'react';
import { ArrowRight, Database, Send, Undo2, XCircle, Upload, FileSpreadsheet, KeyRound, Inbox, TimerOff, Gauge, PenLine, ScanLine, BadgeCheck, Fingerprint, CheckCircle2 } from 'lucide-react';
import { useApp, instOf } from '../../lib/store';
import { today } from '../../lib/rules';
import type { Deposit } from '../../lib/types';
import { diffDays, fmtDate, fmtDateTime, fmtMonth, inr, inrFull, sha256, cls } from '../../lib/util';
import { Badge, EmptyState, Field, Kpi, Modal, OtpBox, PageHead, Panel, QuickActions, VerifBadge } from '../../components/ui';
import { AreaTrend, Columns } from '../../components/charts';

const useBank = () => { const { s, user } = useApp(); return s.deposits.filter(d => d.bankCode === user!.bankCode); };

export function BankDashboard() {
  const { s, user, nav } = useApp(); const t = today(s); const mine = useBank();
  const q = mine.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker');
  const tat = mine.filter(d => d.confirmed && d.requestedOn).map(d => diffDays(d.confirmed!.on, d.requestedOn!));
  const buckets = [['0–3 days', 0, 3], ['4–7 days', 4, 7], ['8–14 days', 8, 14], ['15+ days', 15, 9999]].map(([l, a, b]) => ({ l, n: q.filter(d => { const x = diffDays(t, d.requestedOn!); return x >= (a as number) && x <= (b as number); }).length, late: (a as number) > s.config.bankSla }));
  const months = useMemo(() => { const out: { m: string; key: string; n: number }[] = []; for (let k = 11; k >= 0; k--) { const d0 = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 - k, 1)); const key = d0.toISOString().slice(0, 7); out.push({ key, m: fmtMonth(key + '-01'), n: 0 }); } out.forEach(o => { o.n = mine.filter(d => d.submittedOn.slice(0, 7) <= o.key && !(d.release?.lienReleasedOn && d.release.lienReleasedOn.slice(0, 7) <= o.key) && !(d.replacedBy && (mine.find(x => x.id === d.replacedBy)?.submittedOn || '9').slice(0, 7) <= o.key)).length; }); return out; }, [mine, t]);
  const lien = mine.filter(d => d.release?.status === 'Approved');
  return (
    <>
      <PageHead title={mine[0]?.bankName || 'Bank'} sub={`${user!.designation} · confirmations for FDRs pledged to AICTE`} actions={<button className="btn primary" onClick={() => nav('desk')}>Open confirmation desk<ArrowRight aria-hidden /></button>} />
      <div className="kgrid k4">
        <Kpi icon={Inbox} color="#2f6bff" label="Waiting for confirmation" value={q.length} sub={<>{q.filter(d => d.verification === 'Awaiting checker').length} need the checker's signature</>} spark={buckets.map(b => b.n)} onClick={() => nav('desk')} />
        <Kpi icon={TimerOff} color="#ef4444" tone={q.some(d => diffDays(t, d.requestedOn!) > s.config.bankSla) ? 'bad' : undefined} label={`Past the ${s.config.bankSla}-day SLA`} value={q.filter(d => diffDays(t, d.requestedOn!) > s.config.bankSla).length} sub={<>Escalated after {s.config.bankEscalate} days</>} />
        <Kpi icon={Gauge} color="#12a150" label="Average turnaround" value={tat.length ? (tat.reduce((a, x) => a + x, 0) / tat.length).toFixed(1) : '—'} unit="days" sub={<>across {tat.length} confirmations</>} spark={months.map(x => x.n)} />
        <Kpi icon={KeyRound} color="#ff8a1f" label="Liens to release" value={lien.length} sub="NOC issued by AICTE" onClick={() => nav('lien')} />
      </div>
      <QuickActions items={[
        { icon: Inbox, label: 'Confirmation desk', sub: `${q.length} FDRs waiting`, color: 'linear-gradient(135deg,#2f6bff,#1739a8)', onClick: () => nav('desk') },
        { icon: KeyRound, label: 'Release liens', sub: `${lien.length} NOCs received`, color: 'linear-gradient(135deg,#ff9a3c,#e8700a)', onClick: () => nav('lien') },
        { icon: FileSpreadsheet, label: 'Bulk verification', sub: 'Match a branch export', color: 'linear-gradient(135deg,#16b35c,#0f8a45)', onClick: () => nav('bulk') },
        { icon: PenLine, label: 'E-sign log', sub: 'Every signed confirmation', color: 'linear-gradient(135deg,#7c4dff,#4c2bd1)', onClick: () => nav('esign') },
        { icon: ScanLine, label: 'Scan a sticker', sub: 'Look up an FDR', color: 'linear-gradient(135deg,#0ea5b7,#0b7f8c)', onClick: () => window.dispatchEvent(new Event('sdfp-scan')) },
      ]} />
      <div className="panel" style={{ marginBottom: 20 }}><div className="howstrip">
        <div><span className="no">1</span><b>Fetch from core banking</b><span>The branch officer pulls amount, maturity and lien for the FDR number. AICTE's copy of the institution's claim is never shown.</span></div>
        <div><span className="no">2</span><b>Checker signs with OTP</b><span>The branch manager reviews and e-signs. The signed values are fingerprinted with SHA-256.</span></div>
        <div><span className="no">3</span><b>Portal compares automatically</b><span>A match turns the deposit green for AICTE. A mismatch alerts the Regional Office at once.</span></div>
      </div></div>
      <div className="layout">
        <Panel className="s5" title="Queue by waiting time" sub={`Days since AICTE requested confirmation (SLA ${s.config.bankSla} days)`} foot={<span className="row" style={{ gap: 16 }}><span className="dot" style={{ ['--dc' as string]: 'var(--c1)' }}>Within SLA</span><span className="dot" style={{ ['--dc' as string]: 'var(--bad)' }}>Past SLA</span></span>}>
          <Columns data={buckets} x="l" y="n" color="var(--c1)" highlight={d => !!d.late} hiColor="var(--bad)" height={220} tip={p => <div className="r"><span>FDRs</span><b style={{ margin: 0 }}>{String(p.n)}</b></div>} />
        </Panel>
        <Panel className="s7" title="FDRs held for AICTE at this bank" sub="Open instruments pledged to AICTE at the end of each month">
          <AreaTrend data={months} x="m" y="n" height={220} tip={p => <div className="r"><span>FDRs held</span><b style={{ margin: 0 }}>{String(p.n)}</b></div>} />
        </Panel>
        <Panel className="s12" title="Oldest first" flush>
          <div className="tw"><table className="t"><thead><tr><th>FDR</th><th>Depositor</th><th>Requested</th><th>Waiting</th><th>Stage</th><th /></tr></thead>
            <tbody>{q.sort((a, b) => (a.requestedOn || '').localeCompare(b.requestedOn || '')).map(d => { const w = diffDays(t, d.requestedOn!); return <tr key={d.id} className="click" onClick={() => nav('desk', d.id)}><td className="mono nm">{d.number}</td><td>{instOf(s, d.instId).name}</td><td>{fmtDate(d.requestedOn)}</td><td style={{ color: w > s.config.bankSla ? 'var(--bad)' : undefined, fontWeight: 500 }}>{w} days</td><td><VerifBadge v={d.verification} /></td><td className="r"><ArrowRight width={16} className="faint" aria-hidden /></td></tr>; })}</tbody></table>{!q.length && <div className="empty">All caught up.</div>}</div>
        </Panel>
      </div>
    </>
  );
}

export function Desk() {
  const { s, user, route, toast, nav } = useApp(); const t = today(s); const mine = useBank();
  const isChecker = user!.bankRole === 'checker';
  const q = mine.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker').sort((a, b) => (a.requestedOn || '').localeCompare(b.requestedOn || ''));
  const [sel, setSel] = useState<string | null>(route.id && q.some(d => d.id === route.id) ? route.id : null);
  const d = q.find(x => x.id === sel) || q.find(x => (isChecker ? x.verification === 'Awaiting checker' : x.verification === 'Awaiting bank')) || null;
  return (
    <>
      <PageHead title="Confirmation desk" sub={isChecker ? 'Review what the branch officer fetched and sign with your OTP. The portal compares it with the institution’s claim; you never see that claim.' : 'Fetch each FDR from core banking and send it to the branch manager for signature. The institution’s figures are not shown, so your confirmation is independent.'} crumbs={[{ label: 'Branch desk' }, { label: 'Confirmation desk' }]} />
      <div className="layout">
        <Panel className="s4" title={`Queue (${q.length})`} flush>
          <div className="list">{q.map(x => { const w = diffDays(t, x.requestedOn!); return <button key={x.id} className="li" onClick={() => setSel(x.id)} style={d?.id === x.id ? { background: 'var(--blue-bg)' } : undefined}><span className={`mark ${w > s.config.bankSla ? 'bad' : 'info'}`} /><div><div className="ttl mono">{x.number}</div><div className="meta">{instOf(s, x.instId).name} · {w} days</div></div><Badge tone={x.verification === 'Awaiting checker' ? 'info' : 'warn'}>{x.verification === 'Awaiting checker' ? 'Checker' : 'Maker'}</Badge></button>; })}{!q.length && <div className="empty">No FDRs waiting.</div>}</div>
        </Panel>
        <div className="s8">{d ? <Work key={d.id + d.verification} d={d} /> : <Panel><div className="empty">Select an FDR from the queue.</div></Panel>}</div>
      </div>
      <span hidden>{String(!!toast && !!nav)}</span>
    </>
  );
}

function Work({ d }: { d: Deposit }) {
  const { s, user, act, toast } = useApp(); const t = today(s); const i = instOf(s, d.instId);
  const isChecker = user!.bankRole === 'checker';
  const [v, setV] = useState({ amount: d.maker ? String(Math.round(d.maker.amountLakh * 1e5)) : '', maturity: d.maker?.maturity || '', lien: d.maker ? d.maker.lien : true });
  const [fetched, setFetched] = useState(!!d.maker); const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(false);
  const fetchCbs = async () => {
    setBusy(true); setMiss(false);
    const r = await act<{ found: boolean; amountLakh?: number; maturity?: string; lien?: boolean }>('bank.cbsFetch', { depId: d.id }); setBusy(false);
    if (!r) return;
    if (!r.result.found) { setMiss(true); setFetched(false); toast('Core banking has no FDR with this number at this branch.', 'bad'); return; }
    setV({ amount: String(Math.round(r.result.amountLakh! * 1e5)), maturity: r.result.maturity!, lien: !!r.result.lien }); setFetched(true);
  };
  const toChecker = async () => { if (await act('bank.toChecker', { depId: d.id, amountLakh: +v.amount / 1e5, maturity: v.maturity, lien: v.lien })) toast('Sent to the branch manager for signature.'); };
  const notOurs = async () => { if (await act('bank.notFound', { depId: d.id })) toast('Reported to AICTE as not found.', 'bad'); };
  const sign = async (otp: string) => {
    const err = { m: '' }; const r = await act<{ result: string }>('bank.sign', { depId: d.id, otp }, { quiet: true, err });
    if (!r) return err.m;
    const ok = r.result.result === 'Verified';
    toast(ok ? 'Signed. AICTE sees this FDR as bank-verified.' : 'Signed. The portal found the values differ from the institution’s submission and alerted AICTE.', ok ? 'good' : 'bad');
  };
  const back = async () => { if (await act('bank.sendBack', { depId: d.id })) toast('Returned to the branch officer.', 'info'); };
  const w = diffDays(t, d.requestedOn!);
  return (
    <Panel title={<span className="mono">{d.number}</span>} sub={`Requested ${fmtDate(d.requestedOn)} · waiting ${w} days · IFSC ${d.ifsc}`} actions={<VerifBadge v={d.verification} />}>
      <div className="col">
        <dl className="kv"><dt>Depositor</dt><dd>{i.name} (Trust / Society), {i.city}</dd><dt>In favour of</dt><dd>Member Secretary, AICTE</dd><dt>Branch</dt><dd>{d.branch}</dd></dl>
        <hr className="sep" style={{ margin: 0 }} />
        {d.verification === 'Awaiting bank' && (isChecker ? <div className="hint">Waiting for the branch officer (maker) to fetch and prepare this confirmation.</div> : <>
          <div className="row"><button className="btn primary" onClick={fetchCbs} disabled={busy}><Database aria-hidden />{busy ? 'Fetching…' : fetched ? 'Fetch again' : 'Fetch from core banking'}</button><button className="btn danger" onClick={notOurs}><XCircle aria-hidden />No such FDR</button></div>
          {miss && <div className="hint bad" role="alert">The bank's core banking API returned no record for {d.number} at IFSC {d.ifsc}. If you cannot find it manually, report it as not found.</div>}
          <div className="grid3">
            <Field label="Amount (₹)"><input className={cls('input mono', fetched && 'auto')} value={v.amount} onChange={e => setV({ ...v, amount: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Maturity date"><input type="date" className={cls('input', fetched && 'auto')} value={v.maturity} onChange={e => setV({ ...v, maturity: e.target.value })} /></Field>
            <Field label="Lien to AICTE"><select className={cls('input', fetched && 'auto')} value={v.lien ? 'y' : 'n'} onChange={e => setV({ ...v, lien: e.target.value === 'y' })}><option value="y">Marked</option><option value="n">Not marked</option></select></Field>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!v.amount || !v.maturity} onClick={toChecker}><Send aria-hidden />Send to checker</button></div>
        </>)}
        {d.verification === 'Awaiting checker' && d.maker && <>
          <div className="sectitle" style={{ margin: 0 }}>Prepared by {d.maker.by} on {fmtDate(d.maker.on)}</div>
          <dl className="kv"><dt>Amount</dt><dd>{inrFull(d.maker.amountLakh)}</dd><dt>Maturity</dt><dd>{fmtDate(d.maker.maturity)}</dd><dt>Lien to AICTE</dt><dd>{d.maker.lien ? 'Marked' : 'Not marked'}</dd></dl>
          {isChecker ? <div className="grid2" style={{ alignItems: 'end' }}><OtpBox label="OTP to e-sign" purpose="esign" refId={d.id} busyLabel="E-sign and confirm" onOk={sign} /><button className="btn" onClick={back}><Undo2 aria-hidden />Send back to maker</button></div> : <div className="hint">Waiting for the branch manager (checker) to sign. Switch user from the menu to sign as the checker.</div>}
        </>}
      </div>
    </Panel>
  );
}

export function Lien() {
  const { s, act, toast } = useApp(); const mine = useBank();
  const list = mine.filter(d => d.release?.status === 'Approved'); const done = mine.filter(d => d.release?.status === 'Lien released').sort((a, b) => (b.release!.lienReleasedOn || '').localeCompare(a.release!.lienReleasedOn || '')).slice(0, 12);
  const [sel, setSel] = useState<Deposit | null>(null);
  const release = async (d: Deposit, otp: string) => { const err = { m: '' }; const r = await act('bank.releaseLien', { depId: d.id, otp }, { quiet: true, err }); if (!r) return err.m; toast('Lien released. AICTE and the institution have been informed.'); setSel(null); };
  return (
    <>
      <PageHead title="Lien release" sub="FDRs for which AICTE has issued a No Objection Certificate" crumbs={[{ label: 'Branch desk' }, { label: 'Lien release' }]} />
      <div className="layout">
        <Panel className="s7" title="Waiting for release" flush>
          <div className="tw"><table className="t"><thead><tr><th>FDR</th><th>Depositor</th><th className="r">Amount</th><th>NOC</th><th /></tr></thead>
            <tbody>{list.map(d => <tr key={d.id}><td className="mono nm">{d.number}</td><td>{instOf(s, d.instId).name}</td><td className="r">{inr(d.confirmed?.amountLakh ?? d.claimed.amountLakh)}</td><td><div>{fmtDate(d.release!.approvedOn)}</div><div className="s2 hash">{d.release!.nocHash?.slice(0, 16)}…</div></td><td className="r"><button className="btn sm primary" onClick={() => setSel(d)}><KeyRound aria-hidden />Release lien</button></td></tr>)}</tbody></table>{!list.length && <EmptyState icon={KeyRound} title="No NOCs waiting" text="When AICTE approves a release, the NOC arrives here. Verify its fingerprint, then release the lien with your OTP." />}</div>
        </Panel>
        <Panel className="s5" title="Recently released" flush><div className="list">{done.map(d => <div key={d.id} className="li"><span className="mark good" /><div><div className="ttl mono">{d.number}</div><div className="meta">{instOf(s, d.instId).name} · {fmtDate(d.release!.lienReleasedOn)}</div></div><span /></div>)}{!done.length && <EmptyState icon={CheckCircle2} title="Nothing released yet" text="Liens you release are listed here, and the institution and AICTE are told at once." />}</div></Panel>
      </div>
      {sel && <Modal title={`Release lien on ${sel.number}`} sub={`NOC fingerprint ${sel.release!.nocHash?.slice(0, 24)}… verified against AICTE's record`} onClose={() => setSel(null)} width={520}><OtpBox purpose="lien" refId={sel.id} busyLabel="Release lien" onOk={otp => release(sel, otp)} /></Modal>}
    </>
  );
}

export function Bulk() {
  const { s, user, act, toast } = useApp(); const mine = useBank();
  const [rows, setRows] = useState<{ no: string; amt: number; mat: string; lien: boolean }[] | null>(null);
  const sample = () => { const r = mine.filter(d => d.kind === 'FDR' && d.confirmed && !d.replacedBy).slice(0, 18).map(d => ({ no: d.number, amt: d.confirmed!.amountLakh * 1e5, mat: d.confirmed!.maturity, lien: d.confirmed!.lien })); if (r[2]) r[2].mat = r[2].mat.replace(/^(\d{4})/, y => String(+y - 2)); if (r[5]) r[5].amt = r[5].amt / 2; r.push({ no: user!.bankCode!.slice(0, 2) + '77001234', amt: 2500000, mat: '2033-03-31', lien: true }); setRows(r); };
  const parse = async (f: File) => { const txt = await f.text(); const ls = txt.trim().split(/\r?\n/).slice(1).map(l => l.split(',')); setRows(ls.filter(c => c.length >= 3).map(c => ({ no: c[0].trim(), amt: +c[1], mat: c[2].trim(), lien: (c[3] || 'Y').trim().toUpperCase().startsWith('Y') }))); };
  const res = (rows || []).map(r => { const d = s.deposits.find(x => x.number === r.no && x.bankCode === user!.bankCode); if (!d) return { r, st: 'Not in portal' as const }; const exp = d.confirmed || { amountLakh: d.claimed.amountLakh, maturity: d.claimed.maturity, lien: true }; const ok = Math.abs(exp.amountLakh * 1e5 - r.amt) < 1 && exp.maturity === r.mat && exp.lien === r.lien; return { r, d, st: ok ? 'Matches' as const : 'Differs' as const }; });
  return (
    <>
      <PageHead title="Bulk verification" sub="Upload the branch's export of all FDRs pledged to AICTE. Every row is matched against portal records." crumbs={[{ label: 'Records' }, { label: 'Bulk verification' }]}
        actions={<><button className="btn primary" onClick={sample}><FileSpreadsheet aria-hidden />Load sample export</button><label className="btn"><Upload aria-hidden />Upload CSV<input type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files?.[0] && parse(e.target.files[0])} /></label></>} />
      {!rows ? <Panel><EmptyState icon={FileSpreadsheet} title="Match your branch export in one go" text="Export every FDR pledged to AICTE from core banking as a CSV. Each row is checked against the portal: matches, differences, and FDRs never submitted." action={<><div className="csvprev">{`fdr_number,amount_rupees,maturity_date,lien\nSB55017342,10000000,2036-03-14,Y\nSB61200985,5000000,2033-11-02,Y\nSB70114425,2500000,2031-07-21,N`}</div><button className="btn primary" onClick={sample}><FileSpreadsheet aria-hidden />Load sample export</button></>} /></Panel> : <>
        <div className="kband k4"><div className="kpi"><div className="l">Rows</div><div className="v">{res.length}</div></div><div className="kpi good"><div className="l">Match</div><div className="v">{res.filter(x => x.st === 'Matches').length}</div></div><div className="kpi bad"><div className="l">Differ</div><div className="v">{res.filter(x => x.st === 'Differs').length}</div></div><div className="kpi warn"><div className="l">Not in portal</div><div className="v">{res.filter(x => x.st === 'Not in portal').length}</div><div className="c">Pledged to AICTE but never submitted</div></div></div>
        <Panel flush title="Results" actions={<button className="btn sm" onClick={async () => { if (await act('audit.log', { action: `Bulk reconciliation: ${res.length} rows, ${res.filter(r => r.st !== 'Matches').length} exceptions sent to AICTE` })) toast('Exceptions sent to AICTE.'); }}><Send aria-hidden />Send exceptions to AICTE</button>}>
          <div className="tw"><table className="t"><thead><tr><th>FDR</th><th className="r">Amount (bank file)</th><th>Maturity (bank file)</th><th>Lien</th><th>Portal</th><th>Result</th></tr></thead>
            <tbody>{res.map((x, k) => <tr key={k}><td className="mono">{x.r.no}</td><td className="r">{inrFull(x.r.amt / 1e5)}</td><td>{fmtDate(x.r.mat)}</td><td>{x.r.lien ? 'Y' : 'N'}</td><td>{x.d ? instOf(s, x.d.instId).name : '—'}</td><td>{x.st === 'Matches' ? <Badge tone="good" icon>Matches</Badge> : x.st === 'Differs' ? <Badge tone="bad" icon>Differs</Badge> : <Badge tone="warn" icon>Not in portal</Badge>}</td></tr>)}</tbody></table></div>
        </Panel></>}
    </>
  );
}

export function Esign() {
  const { s, user, nav } = useApp(); const mine = useBank();
  const hist = mine.filter(d => d.confirmed && d.kind === 'FDR').map(d => ({ at: d.confirmed!.on, depId: d.id, number: d.number, by: d.confirmed!.by, result: d.verification === 'Mismatch' ? 'Values differ' : 'Verified', hash: sha256(`${d.number}|${d.confirmed!.amountLakh}|${d.confirmed!.maturity}|${d.confirmed!.on}`), bankCode: d.bankCode }));
  const sess = s.esign.filter(e => e.bankCode === user!.bankCode);
  const list = [...sess, ...hist.filter(h => !sess.some(x => x.depId === h.depId))].sort((a, b) => b.at.localeCompare(a.at));
  const ok = list.filter(e => e.result === 'Verified').length;
  return (
    <>
      <PageHead title="E-sign log" sub="Every confirmation signed at this bank, with the SHA-256 of the signed values" crumbs={[{ label: 'Records' }, { label: 'E-sign log' }]} />
      <div className="kgrid k4">
        <Kpi icon={PenLine} color="#2f6bff" label="Confirmations signed" value={list.length} sub="All time, this bank" />
        <Kpi icon={BadgeCheck} color="#12a150" tone="good" label="Matched the submission" value={ok} sub={`${list.length ? Math.round((ok / list.length) * 100) : 0}% of all signed`} />
        <Kpi icon={XCircle} color="#ef4444" tone={list.length - ok ? 'bad' : undefined} label="Values differed" value={list.length - ok} sub="Flagged to AICTE automatically" />
        <Kpi icon={Fingerprint} color="#7c4dff" label="Signed this session" value={sess.length} sub="Maker-checker with OTP" />
      </div>
      <Panel flush title="Signatures" sub="Newest first">{list.length ? <div className="tw"><table className="t"><thead><tr><th>Date</th><th>FDR</th><th>Signed by</th><th>Result</th><th>Hash of signed values</th></tr></thead>
        <tbody>{list.slice(0, 60).map((e, k) => <tr key={k} className="click" onClick={() => nav('deposit', e.depId)}><td>{fmtDate(e.at)}</td><td className="mono nm">{e.number}</td><td>{e.by}</td><td><Badge tone={e.result === 'Verified' ? 'good' : 'bad'} icon>{e.result}</Badge></td><td><span className="hash">{e.hash.slice(0, 24)}…</span></td></tr>)}</tbody></table></div>
        : <EmptyState icon={PenLine} title="No signatures yet" text="Confirmations signed on the desk appear here with their fingerprints." />}</Panel>
    </>
  );
}
export { fmtDateTime };
