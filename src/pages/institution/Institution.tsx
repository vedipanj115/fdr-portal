import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, FileUp, Upload, Camera, FileText, ScanText, RefreshCcw, Eye, Landmark, ShieldCheck, Layers, BellRing, FolderOpen, ScanLine, AlertTriangle, Clock3, Bell } from 'lucide-react';
import { useApp, instOf } from '../../lib/store';
import { alertsFor, effMaturity, flagsOf, isOpen, life, releaseChecks, today } from '../../lib/rules';
import type { AppState, User } from '../../lib/types';
import { BANKS, regionOf } from '../../lib/data';
import type { Deposit, Doc } from '../../lib/types';
import { addDays, addYears, diffDays, fmtDate, inr, inrFull, pct, sha256, cls } from '../../lib/util';
import { parseFdr, pdfText, pdfToCanvas, scannedPhoto, specimenFdrPdf, type Parsed } from '../../lib/pdf';
import { ocrImage } from '../../lib/ocr';
import { useDocFile } from '../../lib/docs';
import { Badge, Checks, Field, Kpi, LifeDot, Modal, PageHead, Panel, PdfView, QuickActions, Ring, SevBadge, VerifBadge, EmptyState, Toggle } from '../../components/ui';
import { heldOf } from '../officer/Records';
import { SuccessTick } from '../../components/fx';

type Aff = { name: string; hash: string; bytes?: Uint8Array; mime?: string; specimen?: boolean };
export function instNotices(s: AppState, user: User) {
  const own = s.notices.filter(n => n.to === 'institution' && n.instId === user.instId);
  const auto = alertsFor(s).filter(a => a.instId === user.instId && a.to.includes('Institution')).map(a => ({ id: a.id, at: a.at, to: 'institution' as const, title: a.title, body: `${a.detail}. Sent by ${a.channel.toLowerCase()}.`, ref: a.depId, tone: (a.sev === 'critical' ? 'bad' : a.sev === 'action' ? 'warn' : 'info') as 'bad' | 'warn' | 'info' }));
  return [...own, ...auto].sort((a, b) => b.at.localeCompare(a.at));
}
const useMine = () => { const { s, user } = useApp(); return s.deposits.filter(d => d.instId === user!.instId); };

/* ---------------- dashboard ---------------- */
export function InstDashboard() {
  const { s, user, nav } = useApp(); const t = today(s); const i = instOf(s, user!.instId!);
  const mine = useMine(); const open = mine.filter(isOpen); const held = heldOf(s, i.id);
  const flags = open.flatMap(d => flagsOf(d, s, t));
  const notices = instNotices(s, user!).slice(0, 5);
  const ok = held >= i.requiredLakh;
  const fdrs = open.filter(d => d.kind === 'FDR');
  const checks = [
    { ok: open.length > 0, label: 'Security deposit submitted', detail: open.length ? `${open.length} instrument(s) on record` : 'Nothing submitted yet' },
    { ok: open.length > 0 && open.every(d => d.verification === 'Verified'), label: 'Confirmed by the bank', detail: open.filter(d => d.verification !== 'Verified').length ? `${open.filter(d => d.verification !== 'Verified').length} waiting or with a discrepancy` : 'All instruments confirmed' },
    { ok: ok, label: 'Required amount held', detail: `${inr(held)} of ${inr(i.requiredLakh)}` },
    { ok: open.every(d => d.affidavit), label: 'Affidavit on record', detail: open.every(d => d.affidavit) ? 'Uploaded' : 'Upload the Format 2 affidavit' },
    { ok: fdrs.every(d => d.custody?.state === 'In locker'), label: 'Original FDR received by AICTE', detail: fdrs.length ? (fdrs.every(d => d.custody?.state === 'In locker') ? `In ${regionOf(i.region).office} RO locker` : 'Post the original to your Regional Office') : 'Online deposit, no paper needed' },
    { ok: !flags.some(f => f.sev === 'critical'), label: 'No open discrepancy', detail: flags.some(f => f.sev === 'critical') ? 'See Actions for you' : 'Nothing pending' },
  ];
  const dates = open.filter(d => d.verification === 'Verified').flatMap(d => { const m = effMaturity(d); return [
    ...s.config.reminders.map(r => ({ at: addDays(m, -r), title: `${r}-day reminder`, sub: `${d.number} · email and SMS`, color: 'var(--b500)' })),
    { at: m, title: 'Maturity date', sub: `${d.number} · renew or apply for release`, color: 'var(--saffron)' },
    { at: addDays(m, s.config.escalateAfter), title: 'Escalation if no action', sub: 'Case goes to the Regional Director', color: 'var(--bad)' },
  ]; }).filter(x => x.at >= t).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5);
  return (
    <>
      <PageHead title={`Namaste, ${i.name}`} sub={`AICTE Permanent ID ${i.aicteId} · ${i.city}, ${i.state} · ${i.region} Regional Office, ${regionOf(i.region).office}`} actions={<><button className="btn primary" onClick={() => nav('submit')}><Upload aria-hidden />Submit deposit</button><button className="btn" onClick={() => nav('release')}><FileText aria-hidden />Request release</button></>} />
      <div className="kgrid k4">
        <Kpi icon={Landmark} color="#2f6bff" label="Security deposit required" value={inr(i.requiredLakh)} sub={<>{i.type}{i.leased ? ', doubled for leased building' : ''}</>} />
        <Kpi icon={ShieldCheck} color={ok ? '#12a150' : '#ff8a1f'} tone={ok ? 'good' : 'warn'} label="Held, confirmed by bank" value={inr(held)} sub={ok ? 'Requirement met' : `Top-up of ${inr(i.requiredLakh - held)} needed`} />
        <Kpi icon={Layers} color="#7c4dff" label="Instruments" value={open.length} sub={<>{open.filter(d => d.verification !== 'Verified').length} waiting for bank confirmation</>} onClick={() => nav('deposits')} />
        <Kpi icon={BellRing} color={flags.some(f => f.sev === 'critical') ? '#ef4444' : '#ff8a1f'} tone={flags.some(f => f.sev === 'critical') ? 'bad' : undefined} label="Actions for you" value={flags.filter(f => f.sev !== 'info').length} sub={flags.some(f => f.sev !== 'info') ? 'See the list below' : flags.length ? 'Only early notices' : 'Nothing pending'} />
      </div>
      <QuickActions items={[
        { icon: Upload, label: 'Submit deposit', sub: 'FDR or online payment', color: 'linear-gradient(135deg,#2f6bff,#1739a8)', onClick: () => nav('submit') },
        { icon: RefreshCcw, label: 'Renew or replace', sub: 'Before the FDR matures', color: 'linear-gradient(135deg,#0ea5b7,#0b7f8c)', onClick: () => nav('renew') },
        { icon: FileText, label: 'Request release', sub: 'After term or closure', color: 'linear-gradient(135deg,#e05ca0,#b83280)', onClick: () => nav('release') },
        { icon: FolderOpen, label: 'My documents', sub: 'FDRs, affidavits, NOCs', color: 'linear-gradient(135deg,#7c4dff,#4c2bd1)', onClick: () => nav('documents') },
        { icon: ScanLine, label: 'Scan a sticker', sub: 'Check an original FDR', color: 'linear-gradient(135deg,#ff9a3c,#e8700a)', onClick: () => window.dispatchEvent(new Event('sdfp-scan')) },
      ]} />
      <div className="layout">
        <Panel className="s7" title="My deposits" flush actions={<button className="btn sm ghost" onClick={() => nav('deposits')}>All deposits<ArrowRight aria-hidden /></button>}>
          <div className="dcards">{open.map(d => { const l = life(d, s, t); const left = diffDays(effMaturity(d), t); const total = Math.max(1, diffDays(effMaturity(d), d.claimed.issue)); const done = Math.min(100, Math.max(0, 100 - (left / total) * 100));
            return <div key={d.id} className="dcard">
              <div className="hd"><div className="bk">{d.bankName}<small>{d.kind === 'FDR' ? `${d.branch} · IFSC ${d.ifsc}` : 'Paid online to AICTE'}</small></div><div className="row" style={{ gap: 6 }}><LifeDot l={l} /><VerifBadge v={d.verification} /></div></div>
              <div className="no">{d.number}</div>
              <div className="meta"><span>Amount<b>{inr(d.claimed.amountLakh)}</b></span><span>Issued<b>{fmtDate(d.claimed.issue)}</b></span><span>Matures<b>{fmtDate(effMaturity(d))}</b></span><span>In favour of<b>Member Secretary, AICTE</b></span></div>
              <div className="bar"><i style={{ width: done + '%' }} /></div>
              <div className="ft"><span>{left >= 0 ? `${left} days to maturity · ${Math.round(done)}% of term complete` : `Matured ${-left} days ago`}</span><span className="row" style={{ gap: 8 }}>{(l === 'Expiring' || l === 'Matured') && !d.release && <button className="btn sm primary" onClick={() => nav('renew', d.id)}><RefreshCcw aria-hidden />Renew</button>}<button className="btn sm" onClick={() => nav('deposit', d.id)}>View details</button></span></div>
            </div>; })}</div>
          {!open.length && <div className="empty">No deposits yet. <button className="link" onClick={() => nav('submit')}>Submit your security deposit</button>.</div>}
        </Panel>
        <div className="s5 col" style={{ alignContent: 'start' }}>
          <Panel title="Actions for you" flush>
            <div className="list">{flags.length ? flags.map((f, k) => <button key={k} className="li" onClick={() => nav('deposit', f.depId)}><span className={`mark ${f.sev === 'critical' ? 'bad' : f.sev === 'action' ? 'warn' : 'info'}`} /><div><div className="ttl">{f.title}</div><div className="meta">{f.detail}</div></div><SevBadge s={f.sev} /></button>) : <div className="empty">You're up to date.</div>}</div>
          </Panel>
          <Panel title="Recent notices from AICTE" flush actions={<button className="btn sm ghost" onClick={() => nav('notices')}>All<ArrowRight aria-hidden /></button>}>
            <div className="list">{notices.length ? notices.map(n => <button key={n.id} className="li" onClick={() => n.ref && nav('deposit', n.ref)}><span className={`mark ${n.tone}`} /><div><div className="ttl">{n.title}</div><div className="meta">{n.body} · {fmtDate(n.at)}</div></div><span /></button>) : <div className="empty">No notices.</div>}</div>
          </Panel>
        </div>
        <Panel className="s4" title="Compliance checklist" sub="What AICTE checks for your institution">
          <div className="ring"><Ring value={pct(checks.filter(c => c.ok).length, checks.length)} color={checks.every(c => c.ok) ? 'var(--good)' : 'var(--saffron)'} /><div><b>{checks.filter(c => c.ok).length} of {checks.length}</b><span>requirements met</span></div></div>
          <div className="cl">{checks.map(c => <div key={c.label} className={c.ok ? 'ok' : 'no'}><span className="ck">{c.ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}</span><div><b>{c.label}</b><span>{c.detail}</span></div></div>)}</div>
        </Panel>
        <Panel className="s4" title="Key dates" sub="Reminders and deadlines for your deposits">
          {dates.length ? <div className="tl">{dates.map((x, k) => <div key={k} style={{ ['--tc' as string]: x.color }}><time>{fmtDate(x.at).slice(0, 6)}<small>{x.at.slice(0, 4)}</small></time><i /><div><b>{x.title}</b><span>{x.sub}</span></div></div>)}</div> : <div className="empty">No upcoming dates.</div>}
        </Panel>
        <Panel className="s4" title="Frequently asked">
          <div className="faq">
            <details><summary>How long is the deposit held?</summary><p>Ten years from the date of deposit. Interest goes to AICTE; the principal is returned to your Trust or Society at the end of the term or on closure.</p></details>
            <details><summary>Why does the bank confirm separately?</summary><p>So no forged or altered FDR can be accepted. The bank never sees what you entered, and the portal compares both automatically.</p></details>
            <details><summary>What happens near maturity?</summary><p>You get reminders {s.config.reminders.join(', ')} days before. Renew or replace the FDR here; if nothing is done, the case is escalated to the Regional Office.</p></details>
            <details><summary>Where do I send the original FDR?</summary><p>By post to your Regional Office ({regionOf(i.region).office}). It is logged into a locker with a QR sticker when it arrives.</p></details>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function MyDeposits() {
  const { s, nav } = useApp(); const t = today(s); const mine = useMine().sort((a, b) => b.claimed.issue.localeCompare(a.claimed.issue));
  const open = mine.filter(isOpen); const past = mine.filter(d => !isOpen(d));
  return (
    <>
      <PageHead title="My deposits" sub="Every instrument your institution has submitted, including renewed and released ones" actions={<button className="btn primary" onClick={() => nav('submit')}><Upload aria-hidden />Submit deposit</button>} />
      <div className="layout">
        <Panel className="s7" title="Active instruments" sub="Currently held by AICTE as security" flush>
          {open.length ? <div className="dcards" style={{ paddingTop: 0 }}>{open.map(d => { const l = life(d, s, t); const left = diffDays(effMaturity(d), t); const total = Math.max(1, diffDays(effMaturity(d), d.claimed.issue)); const done = Math.min(100, Math.max(0, 100 - (left / total) * 100));
            return <div key={d.id} className="dcard"><div className="hd"><div className="bk">{d.bankName}<small>{d.kind === 'FDR' ? `${d.branch} · IFSC ${d.ifsc}` : 'Paid online to AICTE'}</small></div><div className="row" style={{ gap: 6 }}><LifeDot l={l} /><VerifBadge v={d.verification} /></div></div><div className="no">{d.number}</div>
              <div className="meta"><span>Amount<b>{inr(d.claimed.amountLakh)}</b></span><span>Issued<b>{fmtDate(d.claimed.issue)}</b></span><span>Matures<b>{fmtDate(effMaturity(d))}</b></span></div><div className="bar"><i style={{ width: done + '%' }} /></div>
              <div className="ft"><span>{left >= 0 ? `${left} days to maturity` : `Matured ${-left} days ago`}</span><button className="btn sm" onClick={() => nav('deposit', d.id)}>View details</button></div></div>; })}</div>
            : <EmptyState icon={Landmark} title="No active deposit" text="Submit your security deposit as an FDR from a scheduled bank or pay online." action={<button className="btn primary" onClick={() => nav('submit')}>Submit deposit</button>} />}
        </Panel>
        <Panel className="s5" title="Deposit history" sub="Renewed, replaced and released instruments">
          {mine.length ? <div className="tl">{mine.map(d => { const l = life(d, s, t); return <div key={d.id} style={{ ['--tc' as string]: l === 'Released' ? 'var(--good)' : l === 'Renewed' ? 'var(--c7)' : 'var(--b500)' }}><time>{fmtDate(d.claimed.issue).slice(0, 6)}<small>{d.claimed.issue.slice(0, 4)}</small></time><i /><div><b>{d.number} · {l}</b><span>{d.bankName} · {inr(d.claimed.amountLakh)}{d.replacedBy ? ' · replaced by a renewal' : ''}{d.release?.lienReleasedOn ? ` · released ${fmtDate(d.release.lienReleasedOn)}` : ''}</span></div></div>; })}</div> : <EmptyState icon={Clock3} title="No history yet" text="Every instrument you submit, renew or release will appear here." />}
          {past.length === 0 && mine.length > 0 && <div className="hint" style={{ marginTop: 14 }}>When this FDR is renewed, the old and new instruments stay linked here, so AICTE always has the full history.</div>}
        </Panel>
      </div>
    </>
  );
}

/* ---------------- submission wizard (also used for renewal) ---------------- */
type Fields = { number: string; ifsc: string; branch: string; amount: string; issue: string; maturity: string };
export function Submit({ renewOf }: { renewOf?: string }) {
  const { s, user, act, upload, nav, toast } = useApp(); const t = today(s); const i = instOf(s, user!.instId!);
  const old = renewOf ? s.deposits.find(d => d.id === renewOf) : undefined;
  const [mode, setMode] = useState<'fdr' | 'online'>('fdr');
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<{ bytes: Uint8Array; mime: string; name: string; hash: string } | null>(null);
  const [truth, setTruth] = useState<Deposit['cbs'] | undefined>();
  const [busy, setBusy] = useState<{ p: number; label: string } | null>(null);
  const [auto, setAuto] = useState<Set<string>>(new Set()); const [how, setHow] = useState<'text' | 'ocr' | ''>(''); const [conf, setConf] = useState(0);
  const [f, setF] = useState<Fields>({ number: '', ifsc: '', branch: '', amount: '', issue: '', maturity: '' });
  const [aff, setAff] = useState<Aff | null>(null); const [decl, setDecl] = useState(false);
  const [doneId, setDoneId] = useState(''); const [sending, setSending] = useState(false);
  const done = doneId ? s.deposits.find(d => d.id === doneId) || null : null;

  const fill = (p: Parsed, kind: 'text' | 'ocr') => {
    const nf: Fields = { number: p.number || '', ifsc: p.ifsc || '', branch: p.branch || '', amount: p.amountLakh ? String(Math.round(p.amountLakh * 1e5)) : '', issue: p.issue || '', maturity: p.maturity || '' };
    setF(nf); setAuto(new Set(Object.entries(nf).filter(([, v]) => v).map(([k]) => k))); setHow(kind);
    const n = ['number', 'ifsc', 'amount', 'issue', 'maturity'].filter(k => nf[k as keyof Fields]).length;
    toast(`${n} of 5 key fields read ${kind === 'ocr' ? 'by OCR' : 'from the PDF'}. Please check them.`, n === 5 ? 'good' : 'info'); setStep(2);
  };
  const ingest = async (bytes: Uint8Array, mime: string, name: string, cbs?: Deposit['cbs']) => {
    setFile({ bytes, mime, name, hash: sha256(bytes) }); setTruth(cbs);
    try {
      if (mime === 'application/pdf') {
        setBusy({ p: 0.1, label: 'Reading text from the PDF' });
        const txt = await pdfText(bytes);
        if (txt.replace(/\s/g, '').length > 40) { setBusy(null); fill(parseFdr(txt), 'text'); return; }
        setBusy({ p: 0.15, label: 'Scanned PDF: running OCR' });
        const c = await pdfToCanvas(bytes, 2.4); const r = await ocrImage(c, (p, l) => setBusy({ p, label: l })); setConf(r.confidence); setBusy(null); fill(parseFdr(r.text, true), 'ocr'); return;
      }
      setBusy({ p: 0.05, label: 'Loading OCR engine' });
      const r = await ocrImage(new Blob([bytes], { type: mime }), (p, l) => setBusy({ p, label: l === 'recognizing text' ? 'Reading text from the image' : 'Loading OCR engine' }));
      setConf(r.confidence); setBusy(null); fill(parseFdr(r.text, true), 'ocr');
    } catch (e) { console.error(e); setBusy(null); toast('Could not read that file. Enter the details by hand.', 'bad'); setStep(2); }
  };
  const specimen = async (variant: 'good' | 'bad' | 'photo') => {
    const banks = ['SBIN', 'PUNB', 'CNRB', 'BARB']; const code = banks[(i.id.charCodeAt(6) + (old ? 1 : 0)) % banks.length];
    const issue = t; const number = code.slice(0, 2) + String(50000000 + (Number(i.id.slice(4)) * 7919 + diffDays(t, '2020-01-01') * 31) % 49999999);
    const ff = { bank: BANKS[code].name, branch: `${i.city} Main`, ifsc: `${code}0${String(100000 + Number(i.id.slice(4)) * 1373 % 899999).padStart(6, '0')}`, number, depositor: i.name + ' (Trust / Society)', amountLakh: i.requiredLakh, issue, maturity: addYears(issue, 10) };
    const pdf = specimenFdrPdf(ff);
    const cbs = { amountLakh: ff.amountLakh, maturity: variant === 'bad' ? addYears(issue, 6) : ff.maturity, lien: true };
    if (variant === 'photo') { setBusy({ p: 0.02, label: 'Preparing phone photo' }); const img = await scannedPhoto(pdf); await ingest(img, 'image/jpeg', `FDR_photo_${number}.jpg`, cbs); }
    else await ingest(pdf, 'application/pdf', `FDR_${number}.pdf`, cbs);
    if (variant === 'bad') toast('This specimen says 10 years, but the bank’s record says 6. Watch what happens after the bank confirms.', 'info');
  };
  const code = f.ifsc.slice(0, 4).toUpperCase(); const bank = BANKS[code];
  const amt = +f.amount / 1e5;
  const dup = f.number && s.deposits.find(d => d.number === f.number.toUpperCase() && isOpen(d));
  const term = f.issue && f.maturity ? diffDays(f.maturity, f.issue) / 365.25 : 0;
  const need = old ? old.claimed.amountLakh : Math.max(0, i.requiredLakh - heldOf(s, i.id));
  const checks = [
    { ok: !!bank, label: bank ? `IFSC routes to ${bank.name}` : 'IFSC not recognised', detail: 'Verification request goes to this branch automatically' },
    { ok: !!bank?.scheduled, label: bank?.scheduled ? 'Bank is RBI-scheduled' : 'Bank is not RBI-scheduled', detail: 'Co-operative societies are not accepted' },
    { ok: !dup, label: dup ? 'FDR number already submitted' : 'FDR number not used before', detail: dup ? `Also on record for ${instOf(s, dup.instId).name}` : undefined },
    { ok: Math.abs(term - 10) < 0.02, label: term ? `Term ${term.toFixed(1)} years` : 'Issue and maturity dates needed', detail: '10 years required' },
    { ok: amt >= (need || i.requiredLakh) - 0.001, label: amt ? `${inr(amt)} against ${inr(need || i.requiredLakh)} required` : 'Amount needed', detail: old ? 'A renewal must be at least the original amount' : undefined },
    { ok: !!f.issue && f.issue <= t, label: 'Issue date is not in the future' },
  ];
  const valid = f.number && f.ifsc && amt > 0 && f.issue && f.maturity;
  const submit = async () => {
    setSending(true);
    try {
      const up = file ? await upload(file.bytes, file.mime, file.name) : null;
      const ua = aff?.bytes ? await upload(aff.bytes, aff.mime || 'application/pdf', aff.name) : null;
      const r = await act<{ id: string }>('deposit.submitFdr', { number: f.number, ifsc: f.ifsc, branch: f.branch || 'Main', amountLakh: amt, issue: f.issue, maturity: f.maturity, replaces: old?.id,
        fileId: up?.id, fileName: file?.name, affidavitFileId: ua?.id, affidavitName: aff?.name, affidavitSpecimen: !!aff && !aff.bytes,
        bankRecord: truth || { amountLakh: amt, maturity: f.maturity, lien: true }, readBy: how === 'ocr' ? 'read by OCR' : how === 'text' ? 'read from PDF' : 'typed' });
      if (r) { setDoneId(r.result.id); toast('Submitted. The bank has been asked to confirm.'); }
    } catch (e) { toast((e as Error).message, 'bad'); }
    setSending(false);
  };
  const online = async () => {
    setSending(true);
    const r = await act<{ id: string; txnId: string }>('deposit.payOnline', { amountLakh: need || i.requiredLakh, replaces: old?.id, affidavit: !!aff });
    setSending(false);
    if (r) { setDoneId(r.result.id); toast(`Payment settled (txn ${r.result.txnId}) and reconciled with the AICTE account.`); }
  };

  if (done) return (
    <>
      <PageHead title={old ? 'Renewal submitted' : 'Deposit submitted'} />
      <Panel><div className="col" style={{ maxWidth: 640 }}>
        <div className="donepanel"><div className="burst"><SuccessTick size={84} />{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ background: ['#2f6bff', '#ff8a1f', '#12a150', '#7c4dff', '#e05ca0'][k % 5], ['--x' as string]: `${Math.cos(k / 14 * 6.28) * 90}px`, ['--y' as string]: `${Math.sin(k / 14 * 6.28) * 70}px` }} />)}</div><h2>{done.kind === 'Online' ? 'Payment received' : 'Sent for bank confirmation'}</h2><span className="muted">Reference <b className="mono" style={{ color: 'var(--ink)' }}>{done.id}</b> · {done.number}</span></div>
        {done.kind === 'FDR' ? <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}><li>{done.bankName} confirms amount, maturity and lien from its own records. You'll be notified.</li><li>Post the original FDR to the {i.region} Regional Office, {regionOf(i.region).office}. It is logged into a locker with a QR sticker.</li><li>The portal reminds you before maturity, so the deposit never lapses.</li></ol> : <p>Your online deposit is confirmed against the AICTE account and is active until {fmtDate(done.claimed.maturity)}.</p>}
        <div className="row"><button className="btn primary" onClick={() => nav('deposit', done.id)}>View record</button><button className="btn" onClick={() => nav('home')}>Back to dashboard</button></div>
      </div></Panel>
    </>
  );
  const steps = ['Upload', 'Check details', 'Documents', 'Review and submit'];
  return (
    <>
      <PageHead title={old ? `Renew or replace ${old.number}` : 'Submit security deposit'} sub={old ? `Current instrument matures ${fmtDate(effMaturity(old))}. Upload the renewed FDR or pay online.` : `Required: ${inr(i.requiredLakh)}. You can submit an FDR from a scheduled bank or pay online.`} crumbs={[{ label: 'Apply' }, { label: old ? 'Renew or replace' : 'Submit deposit' }]} />
      <div className="row" style={{ marginBottom: 14 }}><div className="chips"><button className="chip" aria-pressed={mode === 'fdr'} onClick={() => setMode('fdr')}>FDR from a bank</button><button className="chip" aria-pressed={mode === 'online'} onClick={() => setMode('online')}>Pay online</button></div></div>
      {mode === 'online' ? <Panel title="Pay online" sub="Paid into AICTE's account through the payment gateway and reconciled automatically. No paper original is needed.">
        <div className="col" style={{ maxWidth: 560 }}>
          <dl className="kv"><dt>Institution</dt><dd>{i.name}</dd><dt>Amount payable</dt><dd style={{ fontSize: '1.29rem', fontWeight: 600 }}>{inrFull(need || i.requiredLakh)}</dd><dt>Held for</dt><dd>10 years from payment</dd></dl>
          <AffidavitPick aff={aff} setAff={setAff} />
          <label className="check"><input type="checkbox" checked={decl} onChange={e => setDecl(e.target.checked)} /><span>I confirm the Trust / Society authorises this payment as security deposit to AICTE.</span></label>
          <button className="btn primary lg" disabled={!decl || sending} onClick={online}><CreditCard aria-hidden />{sending ? 'Contacting payment gateway…' : <>Pay {inr(need || i.requiredLakh)} (test gateway)</>}</button>
        </div></Panel> : <>
        <div className="wiz">{steps.map((x, k) => <div key={x} className={cls(step === k + 1 && 'on', step > k + 1 && 'done')}><i>{step > k + 1 ? '✓' : k + 1}</i>{x}</div>)}</div>
        {step === 1 && <Panel title="Upload the FDR" sub="A bank PDF, a scanned copy or a phone photo. The details are read automatically.">
          <div className="col">
            <Drop onFile={async fl => ingest(new Uint8Array(await fl.arrayBuffer()), fl.type || (fl.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), fl.name)} />
            {busy && <div className="col" style={{ gap: 6 }}><div className="row" style={{ justifyContent: 'space-between' }}><span><ScanText width={16} style={{ verticalAlign: -3 }} aria-hidden /> {busy.label}…</span><span className="muted">{Math.round(busy.p * 100)}%</span></div><div className="progress"><i style={{ width: `${Math.max(4, busy.p * 100)}%` }} /></div></div>}
            <div className="row" style={{ fontSize: '.929rem' }}><span className="muted">No FDR at hand? Try:</span><button className="btn sm" disabled={!!busy} onClick={() => specimen('good')}><FileText aria-hidden />Specimen FDR (PDF)</button><button className="btn sm" disabled={!!busy} onClick={() => specimen('photo')}><Camera aria-hidden />Phone photo of an FDR (OCR)</button><button className="btn sm" disabled={!!busy} onClick={() => specimen('bad')}>Specimen with wrong maturity</button></div>
            <button className="link" onClick={() => setStep(2)}>Enter details by hand instead</button>
          </div></Panel>}
        {step === 2 && <div className="layout">
          <Panel className="s6" title="Uploaded document" sub={file ? `${file.name} · SHA-256 ${file.hash.slice(0, 16)}…` : 'No file yet'}>{file ? <PdfView bytes={file.bytes} mime={file.mime} width={520} /> : <div className="empty">No document uploaded.</div>}</Panel>
          <Panel className="s6" title="Check the details" sub={how === 'ocr' ? `Read by OCR (confidence ${conf}%). Fields in green were filled automatically; please compare them with the document.` : how === 'text' ? 'Read from the PDF. Fields in green were filled automatically.' : 'Enter the details exactly as printed on the FDR.'}
            foot={<div className="row" style={{ justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn primary" disabled={!valid} onClick={() => setStep(3)}>Continue<ArrowRight aria-hidden /></button></div>}>
            <div className="col">
              <div className="grid2">
                {([['number', 'FDR number'], ['ifsc', 'IFSC'], ['branch', 'Branch'], ['amount', 'Amount (₹)']] as [keyof Fields, string][]).map(([k, l]) => <Field key={k} label={l}><input className={cls('input', auto.has(k) && 'auto', k !== 'branch' && 'mono')} inputMode={k === 'amount' ? 'numeric' : undefined} value={f[k]} onChange={e => { setF({ ...f, [k]: k === 'amount' ? e.target.value.replace(/\D/g, '') : e.target.value }); setAuto(a => { const n = new Set(a); n.delete(k); return n; }); }} /></Field>)}
                <Field label="Date of issue"><input type="date" className={cls('input', auto.has('issue') && 'auto')} value={f.issue} onChange={e => setF({ ...f, issue: e.target.value })} /></Field>
                <Field label="Date of maturity"><input type="date" className={cls('input', auto.has('maturity') && 'auto')} value={f.maturity} onChange={e => setF({ ...f, maturity: e.target.value })} /></Field>
              </div>
              {valid && <><div className="sectitle" style={{ marginBottom: 0 }}>Automatic checks</div><Checks items={checks} /></>}
            </div>
          </Panel>
        </div>}
        {step === 3 && <Panel title="Supporting documents" foot={<div className="row" style={{ justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(2)}>Back</button><button className="btn primary" onClick={() => setStep(4)}>Continue<ArrowRight aria-hidden /></button></div>}>
          <div className="col" style={{ maxWidth: 620 }}><AffidavitPick aff={aff} setAff={setAff} /><div className="hint">Post the original FDR to the {i.region} Regional Office within 5 working days. It is logged into a locker with a QR sticker when it arrives.</div></div></Panel>}
        {step === 4 && <Panel title="Review and submit" foot={<div className="row" style={{ justifyContent: 'space-between' }}><button className="btn" onClick={() => setStep(3)}>Back</button><button className="btn primary lg" disabled={!decl || sending} onClick={submit}><CheckCircle2 aria-hidden />{sending ? "Uploading and submitting…" : "Submit to AICTE"}</button></div>}>
          <div className="grid2" style={{ alignItems: 'start' }}>
            <dl className="kv"><dt>FDR number</dt><dd className="mono">{f.number.toUpperCase()}</dd><dt>Bank</dt><dd>{bank?.name || '—'}, {f.branch}</dd><dt>IFSC</dt><dd className="mono">{f.ifsc.toUpperCase()}</dd><dt>Amount</dt><dd>{inrFull(amt)}</dd><dt>Issue</dt><dd>{fmtDate(f.issue)}</dd><dt>Maturity</dt><dd>{fmtDate(f.maturity)}</dd><dt>Affidavit</dt><dd>{aff ? aff.name : <span style={{ color: 'var(--warn)' }}>Not uploaded (can be added later)</span>}</dd>{old && <><dt>Replaces</dt><dd className="mono">{old.number}</dd></>}</dl>
            <div className="col"><Checks items={checks} /><label className="check"><input type="checkbox" checked={decl} onChange={e => setDecl(e.target.checked)} /><span>I declare the details are true and the FDR is pledged to the Member Secretary, AICTE.</span></label></div>
          </div></Panel>}
      </>}
    </>
  );
}

function Drop({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false); const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cls('drop', over && 'over')} role="button" tabIndex={0} onClick={() => ref.current?.click()} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
      <FileUp aria-hidden /><b>Drop the FDR here, or choose a file</b><span className="muted">PDF, JPG or PNG. Text is read from the PDF; scans and photos are read with OCR.</span>
      <input ref={ref} type="file" hidden accept="application/pdf,image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
function AffidavitPick({ aff, setAff }: { aff: Aff | null; setAff: (a: Aff | null) => void }) {
  return (
    <Field label="Affidavit (Format 2)" hint="Notarised affidavit that the deposit will not be withdrawn without AICTE's NOC">
      <div className="row">{aff ? <><Badge tone="good" icon>{aff.name}</Badge><button className="link" onClick={() => setAff(null)}>Remove</button></> : <><label className="btn sm"><Upload aria-hidden />Upload affidavit<input type="file" hidden accept="application/pdf,image/*" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { const b = new Uint8Array(await fl.arrayBuffer()); setAff({ name: fl.name, hash: sha256(b), bytes: b, mime: fl.type || 'application/pdf' }); } }} /></label><button className="btn sm ghost" onClick={() => setAff({ name: 'Affidavit_Format2_specimen.pdf', hash: sha256('aff' + Date.now()), specimen: true })}>Use specimen</button></>}</div>
    </Field>
  );
}

export function Renew() {
  const { s, user, route, nav } = useApp(); const t = today(s);
  const cands = s.deposits.filter(d => d.instId === user!.instId && isOpen(d) && !d.release && d.verification === 'Verified' && diffDays(effMaturity(d), t) <= 180);
  const pick = route.id && s.deposits.find(d => d.id === route.id);
  if (pick) return <Submit key={pick.id} renewOf={pick.id} />;
  return (
    <>
      <PageHead title="Renew or replace" sub="Choose the instrument you are renewing. Renewal history is kept on the record." />
      <Panel flush>{cands.length ? <div className="list">{cands.map(d => <button key={d.id} className="li" onClick={() => nav('renew', d.id)}><span className="mark warn" /><div><div className="ttl mono">{d.number}</div><div className="meta">{d.bankName} · {inr(d.claimed.amountLakh)} · matures {fmtDate(effMaturity(d))} ({diffDays(effMaturity(d), t)} days)</div></div><span className="btn sm primary">Renew</span></button>)}</div> : <div className="empty">No instrument is due for renewal in the next 6 months. You'll get reminders {s.config.reminders.join(', ')} days before maturity.</div>}</Panel>
    </>
  );
}

/* ---------------- release request ---------------- */
export function ReleaseRequest() {
  const { s, user, route, act, toast, nav } = useApp(); const t = today(s); const i = instOf(s, user!.instId!);
  const mine = s.deposits.filter(d => d.instId === i.id && isOpen(d));
  const cands = mine.filter(d => !d.release && d.verification === 'Verified');
  const reqs = mine.filter(d => d.release);
  const [sel, setSel] = useState<string>(route.id && cands.some(d => d.id === route.id) ? route.id : cands[0]?.id || '');
  const d = cands.find(x => x.id === sel);
  const termDone = d ? diffDays(effMaturity(d), t) <= 0 : false;
  const [reason, setReason] = useState<'10-year term completed' | 'Institution closed' | 'Merger' | 'Replaced by online deposit'>('10-year term completed');
  useEffect(() => { if (i.status !== 'Active') setReason('Institution closed'); }, [i.status]);
  const [letter, setLetter] = useState(false);
  const submit = async () => { if (!d) return; const r = await act('deposit.requestRelease', { depId: d.id, reason, letter }); if (r) { toast('Release request sent to AICTE.'); nav('deposit', d.id); } };
  return (
    <>
      <PageHead title="Release request" sub="Apply for release or refund after the 10-year term, closure or merger. You can follow every step here." />
      <div className="layout">
        <Panel className="s7" title="New request" foot={d && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!letter} onClick={submit}><CheckCircle2 aria-hidden />Submit request</button></div>}>
          {cands.length ? <div className="col">
            <Field label="Instrument"><select className="input" value={sel} onChange={e => setSel(e.target.value)}>{cands.map(x => <option key={x.id} value={x.id}>{x.number} · {x.bankName} · matures {fmtDate(effMaturity(x))}</option>)}</select></Field>
            <Field label="Reason"><select className="input" value={reason} onChange={e => setReason(e.target.value as typeof reason)}><option>10-year term completed</option><option>Institution closed</option><option>Merger</option><option>Replaced by online deposit</option></select></Field>
            {d && !termDone && i.status === 'Active' && reason === '10-year term completed' && <div className="hint warn">This instrument matures on {fmtDate(effMaturity(d))}. A request before then will be held until the term is complete.</div>}
            <Field label="Request letter on the Trust / Society letterhead"><div className="row">{letter ? <Badge tone="good" icon>Release_request_letter.pdf</Badge> : <><label className="btn sm"><Upload aria-hidden />Upload<input type="file" hidden onChange={() => setLetter(true)} /></label><button className="btn sm ghost" onClick={() => setLetter(true)}>Use specimen</button></>}</div></Field>
            {d && <><div className="sectitle" style={{ marginBottom: 0 }}>What AICTE will check</div><Checks items={releaseChecks({ ...d, release: { reason, requestedOn: t, status: 'Requested', letter } }, s)} /></>}
          </div> : <div className="empty">No bank-verified instrument is available for release.</div>}
        </Panel>
        <Panel className="s5" title="My requests" flush>
          <div className="list">{reqs.length ? reqs.map(x => { const st = x.release!.status; return <button key={x.id} className="li" onClick={() => nav('deposit', x.id)}><span className={`mark ${st === 'Lien released' ? 'good' : st === 'Rejected' ? 'bad' : 'info'}`} /><div><div className="ttl mono">{x.number}</div><div className="meta">{x.release!.reason} · requested {fmtDate(x.release!.requestedOn)}</div>
            <div className="steps" style={{ marginTop: 8 }}>{['Requested', 'Approved', 'Lien released'].map((k, n) => { const idx = ['Requested', 'Approved', 'Lien released'].indexOf(st); return <div key={k} className={cls('step', n < idx || st === 'Lien released' ? 'done' : n === idx ? 'cur' : '')}><div className="bar" /><span>{k === 'Approved' ? 'NOC issued' : k}</span></div>; })}</div></div><Badge tone={st === 'Lien released' ? 'good' : st === 'Rejected' ? 'bad' : 'info'}>{st}</Badge></button>; }) : <div className="empty">No requests yet.</div>}</div>
        </Panel>
      </div>
    </>
  );
}

export function InstDocuments() {
  const { nav } = useApp(); const mine = useMine();
  const [view, setView] = useState<{ d: Deposit; doc: Doc } | null>(null);
  const [chk, setChk] = useState<null | { ok: boolean; name: string; h: string }>(null);
  const docs = mine.flatMap(d => d.docs.map(doc => ({ d, doc }))).sort((a, b) => b.doc.uploadedOn.localeCompare(a.doc.uploadedOn));
  const { file } = useDocFile(view?.doc, view?.d);
  const open = mine.filter(isOpen);
  const req = [
    { label: 'FDR copy or payment receipt', ok: open.some(d => d.docs.some(x => x.kind === 'FDR' || x.kind === 'Payment receipt')) },
    { label: 'Affidavit (Format 2), notarised', ok: open.length > 0 && open.every(d => d.affidavit) },
    { label: 'Original FDR posted to the Regional Office', ok: open.filter(d => d.kind === 'FDR').every(d => d.custody?.state === 'In locker') },
    { label: 'Release request letter (only when applying for release)', ok: true },
  ];
  return (
    <>
      <PageHead title="Documents" sub="Everything you have submitted, with the fingerprint recorded at submission" />
      <div className="layout">
        <Panel className="s8" title={`${docs.length} documents`} flush>
          {docs.length ? <div className="tw"><table className="t"><thead><tr><th>Document</th><th>Instrument</th><th>Uploaded</th><th>SHA-256</th><th /></tr></thead>
            <tbody>{docs.map(({ d, doc }) => <tr key={doc.id + d.id}><td><div className="nm">{doc.name}</div><div className="s2">{doc.kind}</div></td><td className="mono">{d.number}</td><td>{fmtDate(doc.uploadedOn)}</td><td><span className="hash">{doc.sha256.slice(0, 20)}…</span></td><td className="r"><button className="btn sm" onClick={() => setView({ d, doc })}><Eye aria-hidden />View</button></td></tr>)}</tbody></table></div>
            : <EmptyState icon={FolderOpen} title="No documents yet" text="Documents you upload with a deposit are stored here with their fingerprints." action={<button className="btn primary" onClick={() => nav('submit')}>Submit deposit</button>} />}
        </Panel>
        <div className="s4 col" style={{ alignContent: 'start' }}>
          <Panel title="Check a copy" sub="Is a file identical to what you submitted?">
            <div className="col">
              <label className="btn primary"><FileUp aria-hidden />Choose a file<input type="file" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const h = sha256(new Uint8Array(await f.arrayBuffer())); setChk({ ok: docs.some(x => x.doc.sha256 === h), name: f.name, h }); }} /></label>
              {chk ? (chk.ok ? <div className="verdict good"><b>Matches a submitted document</b><span className="hash">{chk.h.slice(0, 32)}…</span></div> : <div className="verdict bad"><b>No match</b><span>{chk.name} is not identical to anything you submitted.</span></div>) : <p className="muted" style={{ fontSize: '.86rem' }}>The file never leaves your browser; only its SHA-256 fingerprint is compared.</p>}
            </div>
          </Panel>
          <Panel title="Required documents">
            <div className="cl">{req.map(r => <div key={r.label} className={r.ok ? 'ok' : 'no'}><span className="ck">{r.ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}</span><div><b>{r.label}</b><span>{r.ok ? 'On record' : 'Pending'}</span></div></div>)}</div>
          </Panel>
        </div>
      </div>
      {view && file && <Modal title={view.doc.name} onClose={() => setView(null)} width={760}><PdfView bytes={file.bytes} mime={file.mime} width={680} /></Modal>}
    </>
  );
}

export function Notices() {
  const { s, user, nav, toast } = useApp();
  const list = user!.role === 'institution' ? instNotices(s, user!) : s.notices.filter(n => n.to === user!.role && (!n.bankCode || n.bankCode === user!.bankCode));
  const [pref, setPref] = useState({ email: true, sms: true, wa: false, digest: true });
  const set = (k: keyof typeof pref) => (v: boolean) => { setPref(p => ({ ...p, [k]: v })); toast('Preference saved.', 'info'); };
  return (
    <>
      <PageHead title="Notices" sub="Messages from AICTE and automatic reminders. Copies are sent by email and SMS." />
      <div className="layout">
        <Panel className="s8" title={`${list.length} notices`} flush>
          <div className="list">{list.length ? list.map(n => <button key={n.id} className="li" onClick={() => n.ref && nav('deposit', n.ref)}><span className={`mark ${n.tone}`} /><div><div className="ttl">{n.title}</div><div className="meta">{n.body}</div></div><span className="faint nowrap">{fmtDate(n.at)}</span></button>)
            : <EmptyState icon={Bell} title="You're all caught up" text="Automatic reminders and messages from AICTE will appear here." />}</div>
        </Panel>
        <div className="s4 col" style={{ alignContent: 'start' }}>
          <Panel title="How we reach you">
            <div className="toggle"><div><b>Email</b><span>{user!.email || 'registered email'}</span></div><Toggle on={pref.email} onChange={set('email')} label="Email" /></div>
            <div className="toggle"><div><b>SMS</b><span>Mobile ending {user!.mobile.slice(-4)}</span></div><Toggle on={pref.sms} onChange={set('sms')} label="SMS" /></div>
            <div className="toggle"><div><b>WhatsApp</b><span>Optional, via the official business number</span></div><Toggle on={pref.wa} onChange={set('wa')} label="WhatsApp" /></div>
            <div className="toggle"><div><b>Weekly summary</b><span>Every Monday, 9:00</span></div><Toggle on={pref.digest} onChange={set('digest')} label="Weekly summary" /></div>
          </Panel>
          <Panel title="Reminder schedule"><p className="muted" style={{ fontSize: '.88rem' }}>AICTE sends reminders <b style={{ color: 'var(--ink)' }}>{s.config.reminders.join(', ')} days</b> before each maturity. If nothing is done, the case is escalated to the Regional Office <b style={{ color: 'var(--ink)' }}>{s.config.escalateAfter} days</b> after maturity.</p></Panel>
        </div>
      </div>
    </>
  );
}
