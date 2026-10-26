import { useMemo, useState } from 'react';
import { ArrowRight, Send, CheckCircle2, XCircle, FileCheck2 } from 'lucide-react';
import { useApp, instOf } from '../../lib/store';
import { alertsFor, effMaturity, flagsOf, isOpen, releaseChecks, today } from '../../lib/rules';
import type { Deposit, Doc } from '../../lib/types';
import { diffDays, fmtDate, fmtMonth, inr, canDownload, download } from '../../lib/util';
import { Badge, Checks, Modal, OtpBox, PageHead, Panel, PdfView, SevBadge, Tabs, VerifBadge } from '../../components/ui';
import { Columns } from '../../components/charts';
import { SuccessTick } from '../../components/fx';

/* ---------------- verification queue ---------------- */
export function VerifyQueue() {
  const { s, nav, act, toast } = useApp(); const t = today(s);
  const [tab, setTab] = useState<'waiting' | 'disc' | 'incomplete'>('waiting');
  const open = s.deposits.filter(isOpen);
  const waiting = open.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker').sort((a, b) => (a.requestedOn || '').localeCompare(b.requestedOn || ''));
  const disc = open.filter(d => flagsOf(d, s, t).some(f => ['amount', 'maturity', 'lien', 'notfound', 'bank', 'dup', 'tamper'].includes(f.code)));
  const incomplete = open.filter(d => d.verification === 'Not requested' || !d.affidavit);
  const remindAll = async () => { const r = await act<{ count: number }>('verify.remindAll'); if (r) toast(`${r.result.count} reminders emailed to banks past the ${s.config.bankSla}-day SLA.`); };
  const list = tab === 'waiting' ? waiting : tab === 'disc' ? disc : incomplete;
  return (
    <>
      <PageHead title="Verification queue" sub="Instruments waiting for bank confirmation, discrepancies and incomplete records" crumbs={[{ label: 'Workflows' }, { label: 'Verification queue' }]} actions={tab === 'waiting' && <button className="btn primary" onClick={remindAll}><Send aria-hidden />Remind banks past SLA</button>} />
      <div className="kband k4">
        <div className="kpi"><div className="l">Waiting for banks</div><div className="v">{waiting.length}</div><div className="c">{waiting.filter(d => diffDays(t, d.requestedOn!) > s.config.bankSla).length} past the {s.config.bankSla}-day SLA</div></div>
        <div className="kpi bad"><div className="l">Discrepancies</div><div className="v">{disc.length}</div><div className="c">Values differ, bank ineligible or file altered</div></div>
        <div className="kpi warn"><div className="l">Incomplete records</div><div className="v">{incomplete.length}</div><div className="c">Missing documents or never sent to the bank</div></div>
        <div className="kpi good"><div className="l">Verified this month</div><div className="v">{s.deposits.filter(d => d.confirmed && d.confirmed.on.slice(0, 7) === t.slice(0, 7)).length}</div><div className="c">Confirmations received in {fmtMonth(t)}</div></div>
      </div>
      <Panel flush>
        <div style={{ padding: '0 8px' }}><Tabs value={tab} onChange={setTab} items={[{ id: 'waiting', label: 'Waiting for bank', count: waiting.length }, { id: 'disc', label: 'Discrepancies', count: disc.length }, { id: 'incomplete', label: 'Incomplete records', count: incomplete.length }]} /></div>
        <div className="tw"><table className="t"><thead><tr><th>Instrument</th><th>Institution</th><th>Bank</th><th>{tab === 'waiting' ? 'Waiting' : 'Issue'}</th><th>Verification</th><th /></tr></thead>
          <tbody>{list.map(d => { const i = instOf(s, d.instId); const age = d.requestedOn ? diffDays(t, d.requestedOn) : 0; const f = flagsOf(d, s, t).filter(x => x.sev !== 'info');
            return <tr key={d.id} className="click" onClick={() => nav('deposit', d.id)}>
              <td><div className="mono nm">{d.number}</div><div className="s2">{d.id}</div></td>
              <td><div className="nm">{i.name}</div><div className="s2">{i.city} · {i.region}</div></td>
              <td>{d.bankName}</td>
              <td>{tab === 'waiting' ? <><b style={{ color: age > s.config.bankEscalate ? 'var(--bad)' : age > s.config.bankSla ? 'var(--warn)' : 'var(--ink)' }}>{age} days</b><div className="s2">{age > s.config.bankEscalate ? 'Escalated to nodal officer' : age > s.config.bankSla ? 'Reminder sent' : 'Within SLA'}</div></> : f.length ? <span style={{ color: f[0].sev === 'critical' ? 'var(--bad)' : 'var(--warn)', fontWeight: 500 }}>{f.map(x => x.title).join(', ')}</span> : d.verification === 'Not requested' ? 'Not sent to bank' : '—'}</td>
              <td><VerifBadge v={d.verification} /></td>
              <td className="r"><ArrowRight width={16} className="faint" aria-hidden /></td>
            </tr>; })}</tbody></table>{!list.length && <div className="empty">Nothing here.</div>}</div>
      </Panel>
    </>
  );
}

/* ---------------- maturity and renewals ---------------- */
export function Maturity() {
  const { s, nav } = useApp(); const t = today(s);
  const [tab, setTab] = useState<'upcoming' | 'overdue' | 'renewed'>('upcoming');
  const maxR = Math.max(...s.config.reminders);
  const live = s.deposits.filter(d => isOpen(d) && d.verification === 'Verified' && !(d.release && d.release.status !== 'Rejected'));
  const upcoming = live.filter(d => { const l = diffDays(effMaturity(d), t); return l >= 0 && l <= maxR; }).sort((a, b) => effMaturity(a).localeCompare(effMaturity(b)));
  const overdue = live.filter(d => diffDays(effMaturity(d), t) < 0).sort((a, b) => effMaturity(a).localeCompare(effMaturity(b)));
  const renewed = s.deposits.filter(d => d.replaces).sort((a, b) => b.submittedOn.localeCompare(a.submittedOn)).slice(0, 40);
  const months = useMemo(() => { const out: { m: string; key: string; n: number; v: number; season: boolean }[] = []; for (let k = 0; k < 24; k++) { const d0 = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + k, 1)); const key = d0.toISOString().slice(0, 7); out.push({ key, m: fmtMonth(key + '-01'), n: 0, v: 0, season: d0.getUTCMonth() < 4 }); } live.forEach(d => { const mm = out.find(x => x.key === effMaturity(d).slice(0, 7)); if (mm) { mm.n++; mm.v += d.claimed.amountLakh; } }); return out; }, [live, t]);
  const alerts = alertsFor(s);
  const stage = (d: Deposit) => { const l = diffDays(effMaturity(d), t); return s.config.reminders.slice().sort((a, b) => b - a).map(r => ({ r, sent: l <= r })); };
  return (
    <>
      <PageHead title="Maturity & renewals" sub={`Automatic tracking of validity and maturity. Reminders go out ${s.config.reminders.join(', ')} days before maturity; unresolved cases escalate ${s.config.escalateAfter} days after.`} crumbs={[{ label: 'Workflows' }, { label: 'Maturity & renewals' }]} actions={<button className="btn" onClick={() => nav('settings')}>Reminder settings</button>} />
      <Panel title="Maturities over the next 24 months" sub="Number of bank-verified deposits maturing each month" foot={<span className="row" style={{ gap: 16 }}><span className="dot" style={{ ['--dc' as string]: 'var(--c1)' }}>Other months</span><span className="dot" style={{ ['--dc' as string]: 'var(--c4)' }}>Approval season (Jan–Apr)</span></span>}>
        <Columns data={months} x="m" y="n" color="var(--c1)" highlight={d => !!d.season} hiColor="var(--c4)" height={220} tip={p => <><div className="r"><span>Deposits</span><b style={{ margin: 0 }}>{String(p.n)}</b></div><div className="r"><span>Value</span><span>{inr(p.v as number)}</span></div></>} />
      </Panel>
      <div style={{ height: 16 }} />
      <Panel flush>
        <div style={{ padding: '0 8px' }}><Tabs value={tab} onChange={setTab} items={[{ id: 'upcoming', label: `Maturing in ${maxR} days`, count: upcoming.length }, { id: 'overdue', label: 'Matured, no action', count: overdue.length }, { id: 'renewed', label: 'Recent renewals', count: renewed.length }]} /></div>
        {tab !== 'renewed' ? <div className="tw"><table className="t"><thead><tr><th>Instrument</th><th>Institution</th><th className="r">Amount</th><th>Maturity</th><th>{tab === 'upcoming' ? 'Reminders sent' : 'Follow-up'}</th><th /></tr></thead>
          <tbody>{(tab === 'upcoming' ? upcoming : overdue).map(d => { const i = instOf(s, d.instId); const l = diffDays(effMaturity(d), t); const esc = alerts.some(a => a.depId === d.id && a.stage === 'Escalation');
            return <tr key={d.id} className="click" onClick={() => nav('deposit', d.id)}>
              <td><div className="mono nm">{d.number}</div><div className="s2">{d.bankName}</div></td>
              <td><div className="nm">{i.name}</div><div className="s2">{i.city} · {i.region}</div></td>
              <td className="r">{inr(d.claimed.amountLakh)}</td>
              <td className="nowrap"><div>{fmtDate(effMaturity(d))}</div><div className="s2" style={{ color: l < 0 ? 'var(--bad)' : l <= 30 ? 'var(--warn)' : undefined }}>{l >= 0 ? `in ${l} days` : `${-l} days ago`}</div></td>
              <td>{tab === 'upcoming' ? <div className="row" style={{ gap: 4 }}>{stage(d).map(x => <Badge key={x.r} tone={x.sent ? 'good' : 'neutral'}>{x.r} d{x.sent ? ' ✓' : ''}</Badge>)}</div> : esc ? <Badge tone="bad" icon>Escalated to Regional Director</Badge> : <Badge tone="warn" icon>Institution reminded</Badge>}</td>
              <td className="r"><ArrowRight width={16} className="faint" aria-hidden /></td></tr>; })}</tbody></table>{!(tab === 'upcoming' ? upcoming : overdue).length && <div className="empty">Nothing here.</div>}</div>
          : <div className="tw"><table className="t"><thead><tr><th>New instrument</th><th>Institution</th><th>Replaced</th><th>Submitted</th><th>Verification</th></tr></thead>
            <tbody>{renewed.map(d => { const old = s.deposits.find(x => x.id === d.replaces); const i = instOf(s, d.instId); return <tr key={d.id} className="click" onClick={() => nav('deposit', d.id)}><td><div className="mono nm">{d.number}</div><div className="s2">valid to {fmtDate(effMaturity(d))}</div></td><td><div className="nm">{i.name}</div><div className="s2">{i.city}</div></td><td><div className="mono">{old?.number}</div><div className="s2">matured {fmtDate(old && effMaturity(old))}</div></td><td>{fmtDate(d.submittedOn)}</td><td><VerifBadge v={d.verification} /></td></tr>; })}</tbody></table></div>}
      </Panel>
    </>
  );
}

/* ---------------- release requests ---------------- */
export function Releases() {
  const { s, nav } = useApp();
  const [tab, setTab] = useState<'Requested' | 'Approved' | 'Lien released'>('Requested');
  const [sel, setSel] = useState<string | null>(null);
  const list = s.deposits.filter(d => d.release && d.release.status === tab).sort((a, b) => b.release!.requestedOn.localeCompare(a.release!.requestedOn));
  const cnt = (st: string) => s.deposits.filter(d => d.release?.status === st).length;
  return (
    <>
      <PageHead title="Release requests" sub="Release, discharge or refund of security deposits. Conditions are checked automatically; only the competent authority can approve." crumbs={[{ label: 'Workflows' }, { label: 'Release requests' }]} />
      <Panel flush>
        <div style={{ padding: '0 8px' }}><Tabs value={tab} onChange={setTab} items={[{ id: 'Requested', label: 'Awaiting decision', count: cnt('Requested') }, { id: 'Approved', label: 'NOC issued, lien pending', count: cnt('Approved') }, { id: 'Lien released', label: 'Completed', count: cnt('Lien released') }]} /></div>
        <div className="tw"><table className="t"><thead><tr><th>Institution</th><th>Instrument</th><th>Reason</th><th>Requested</th><th>Conditions</th><th /></tr></thead>
          <tbody>{list.slice(0, 60).map(d => { const i = instOf(s, d.instId); const ch = releaseChecks(d, s); const ok = ch.filter(c => c.ok).length;
            return <tr key={d.id}><td><div className="nm">{i.name}</div><div className="s2">{i.city} · {i.status}</div></td><td><div className="mono">{d.number}</div><div className="s2">{d.bankName} · {inr(d.claimed.amountLakh)}</div></td><td>{d.release!.reason}</td><td>{fmtDate(d.release!.requestedOn)}</td>
              <td>{tab === 'Requested' ? (ok === ch.length ? <Badge tone="good" icon>All {ch.length} met</Badge> : <Badge tone="warn" icon>{ok} of {ch.length} met, on hold</Badge>) : tab === 'Approved' ? <Badge tone="info">NOC {fmtDate(d.release!.approvedOn)}</Badge> : <Badge tone="good" icon>Released {fmtDate(d.release!.lienReleasedOn)}</Badge>}</td>
              <td className="r nowrap">{tab === 'Requested' ? <button className="btn sm primary" onClick={() => setSel(d.id)}>Review</button> : <button className="btn sm" onClick={() => nav('deposit', d.id)}>Open</button>}</td></tr>; })}</tbody></table>{!list.length && <div className="empty">No requests here.</div>}</div>
      </Panel>
      {sel && <ReleaseReview id={sel} close={() => setSel(null)} />}
    </>
  );
}

function ReleaseReview({ id, close }: { id: string; close: () => void }) {
  const { s, act, toast, fetchDoc } = useApp();
  const d = s.deposits.find(x => x.id === id)!; const i = instOf(s, d.instId); const ch = releaseChecks(d, s); const allOk = ch.every(c => c.ok);
  const [step, setStep] = useState<'review' | 'otp' | 'noc' | 'reject'>('review'); const [noc, setNoc] = useState<Uint8Array | null>(null); const [why, setWhy] = useState('');
  const clearComplaints = async () => { if (await act('release.clearComplaints', { depId: d.id })) toast('Complaints recorded as resolved. Conditions re-checked.'); };
  const approve = async (otp: string) => {
    const err = { m: '' }; const r = await act<{ nocId: string }>('release.approve', { depId: d.id, otp }, { quiet: true, err });
    if (!r) return err.m;
    try { const f = await fetchDoc({ id: r.result.nocId, name: `NOC_${d.id}.pdf`, kind: 'NOC' } as Doc, d); setNoc(f.bytes); } catch { /* shown in documents tab */ }
    setStep('noc');
  };
  return (
    <Modal title={step === 'noc' ? 'No Objection Certificate issued' : `Release request: ${i.name}`} sub={`${d.number} · ${d.bankName} · ${inr(d.claimed.amountLakh)} · ${d.release!.reason}`} onClose={close} width={step === 'noc' ? 760 : 640}
      foot={step === 'review' ? <><button className="btn danger" onClick={() => setStep('reject')}><XCircle aria-hidden />Reject</button><button className="btn primary" disabled={!allOk} onClick={() => setStep('otp')}><CheckCircle2 aria-hidden />Approve release</button></> : step === 'noc' ? <>{canDownload() && noc && <button className="btn" onClick={() => download(`NOC_${d.id}.pdf`, new Blob([noc], { type: 'application/pdf' }))}>Download PDF</button>}<button className="btn primary" onClick={close}>Done</button></> : undefined}>
      {step === 'review' && <div className="col">
        <Checks items={ch} />
        {!allOk && <div className="hint warn">The request is on hold until every condition is met. {i.openComplaints > 0 && <button className="link" onClick={clearComplaints}>Record complaints as resolved</button>}</div>}
      </div>}
      {step === 'otp' && <div className="col"><p>Approving releases {inr(d.claimed.amountLakh)} held as security. Confirm with the OTP sent to your registered mobile.</p><OtpBox purpose="release" refId={d.id} busyLabel="Approve and issue NOC" onOk={approve} /></div>}
      {step === 'reject' && <div className="col"><textarea className="input" rows={3} placeholder="Reason for rejection" value={why} onChange={e => setWhy(e.target.value)} /><button className="btn danger" disabled={!why.trim()} onClick={async () => { if (await act('release.reject', { depId: d.id, reason: why })) { toast('Request rejected. The institution has been informed.'); close(); } }}>Confirm rejection</button></div>}
      {step === 'noc' && <div className="col"><div className="donepanel" style={{ paddingTop: 4 }}><SuccessTick size={64} /><b style={{ font: '600 1.1rem var(--f-head)', color: 'var(--ink)' }}>Release approved</b></div><div className="hint good"><FileCheck2 width={16} style={{ verticalAlign: -3 }} aria-hidden /> NOC generated, fingerprinted and sent to the institution and {d.bankName}. The bank now sees a lien-release task.</div>{noc && <PdfView bytes={noc} mime="application/pdf" width={680} />}</div>}
    </Modal>
  );
}

export { SevBadge };
