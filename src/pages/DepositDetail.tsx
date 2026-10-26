import { useMemo, useState } from 'react';
import { anomalyScores } from '../lib/anomaly';
import { AlertTriangle, BadgeCheck, BellRing, CalendarClock, Check, CheckCircle2, Eye, FileCheck2, FileText, FileUp, Fingerprint, Inbox, Pencil, QrCode, RefreshCcw, Send, ShieldCheck, Upload } from 'lucide-react';
import { useApp, instOf } from '../lib/store';
import { effMaturity, flagsOf, life, releaseChecks, today } from '../lib/rules';
import type { Deposit, Doc, Note } from '../lib/types';
import { diffDays, fmtDate, fmtDateTime, inr, inrFull, sha256, cls } from '../lib/util';
import { useDocFile } from '../lib/docs';
import { qrDataUrl, stickerCode } from '../lib/qr';
import { Badge, Checks, Field, LifeDot, Modal, PageHead, Panel, PdfView, SevBadge, Tabs, VerifBadge } from '../components/ui';

export default function DepositDetail({ id }: { id: string }) {
  const { s, user, nav } = useApp();
  const d = s.deposits.find(x => x.id === id);
  const [tab, setTab] = useState<'summary' | 'docs' | 'history' | 'notes'>('summary');
  const [modal, setModal] = useState<null | 'edit' | 'notice' | 'qr' | { doc: Doc; mode: 'view' | 'check' }>(null);
  if (!d || !user) return <div className="empty">Record not found.</div>;
  if (user.role === 'institution' && d.instId !== user.instId) return <div className="empty">This record belongs to another institution.</div>;
  if (user.role === 'bank' && d.bankCode !== user.bankCode) return <div className="empty">This record is with another bank.</div>;
  const inst = instOf(s, d.instId); const t = today(s); const l = life(d, s, t); const flags = flagsOf(d, s, t);
  const back = user.role === 'officer' ? { label: 'Deposit register', go: () => nav('register') } : user.role === 'institution' ? { label: 'My deposits', go: () => nav('deposits') } : { label: 'Confirmation desk', go: () => nav('desk') };
  return (
    <>
      <PageHead title={`${d.kind === 'FDR' ? 'FDR' : 'Online deposit'} ${d.number}`} crumbs={[back, { label: d.id }]}
        sub={<span className="row" style={{ gap: 10, marginTop: 4 }}><span>{inst.name}, {inst.city}</span><LifeDot l={l} /><VerifBadge v={d.verification} />{s.scrutinyClosed.includes(d.id) && <Badge tone="good" icon>Scrutiny complete</Badge>}</span>}
        actions={<Actions d={d} open={setModal} />} />
      <Lifecycle d={d} />
      {flags.length > 0 && user.role !== 'bank' && <div className="col" style={{ marginBottom: 16 }}>{flags.map((f, i) => <div key={i} className={cls('hint', f.sev === 'critical' ? 'bad' : f.sev === 'action' ? 'warn' : '')} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><SevBadge s={f.sev} /><div><b style={{ color: 'var(--ink)' }}>{f.title}.</b> {f.detail}. <span className="faint">Rule: {f.rule}</span></div></div>)}</div>}
      <Tabs value={tab} onChange={setTab} items={[{ id: 'summary', label: 'Summary' }, { id: 'docs', label: 'Documents', count: d.docs.length }, { id: 'history', label: 'History' }, { id: 'notes', label: 'Scrutiny notes', count: d.notes.length }]} />
      <div style={{ marginTop: 16 }}>
        {tab === 'summary' && <Summary d={d} />}
        {tab === 'docs' && <Docs d={d} open={setModal} />}
        {tab === 'history' && <History d={d} />}
        {tab === 'notes' && <Notes d={d} />}
      </div>
      {modal === 'edit' && <EditFields d={d} close={() => setModal(null)} />}
      {modal === 'notice' && <NoticeModal d={d} close={() => setModal(null)} />}
      {modal === 'qr' && <Modal title="QR sticker for the original FDR" onClose={() => setModal(null)} width={460}><div className="qrbox"><img src={qrDataUrl(stickerCode(d))} alt={`QR sticker for ${d.number}`} /><b className="mono">{d.number}</b><span className="muted">{inst.name} · Locker {d.custody?.locker}</span><span className="hash">{stickerCode(d)}</span><span className="muted" style={{ fontSize: '.857rem' }}>Print and attach to the envelope holding the original. Scanning it with Quick Scan confirms it is genuine and shows custody.</span></div></Modal>}
      {modal && typeof modal === 'object' && <DocModal d={d} doc={modal.doc} mode={modal.mode} close={() => setModal(null)} />}
    </>
  );
}

function Actions({ d, open }: { d: Deposit; open: (m: 'edit' | 'notice' | 'qr') => void }) {
  const { s, user, act, toast, nav } = useApp(); const t = today(s); const l = life(d, s, t);
  if (!user) return null;
  const crit = flagsOf(d, s, t).some(f => f.sev === 'critical');
  if (user.role === 'officer') return <>
    {(d.verification === 'Not requested' || d.verification === 'Not found') && <button className="btn primary" onClick={async () => { if (await act('deposit.requestVerification', { depId: d.id })) toast(`Verification request sent to ${d.bankName}.`); }}><Send aria-hidden />Request bank verification</button>}
    {(d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker') && <button className="btn" onClick={async () => { if (await act('deposit.remindBank', { depId: d.id })) toast('Reminder sent to the bank by email.'); }}><Send aria-hidden />Remind bank</button>}
    <button className="btn" onClick={() => open('notice')}><AlertTriangle aria-hidden />Raise notice</button>
    <button className="btn" onClick={() => open('edit')}><Pencil aria-hidden />Edit permitted fields</button>
    {d.custody && <button className="btn" onClick={() => open('qr')}><QrCode aria-hidden />QR sticker</button>}
    {!s.scrutinyClosed.includes(d.id) && <button className="btn good" disabled={crit || d.verification !== 'Verified'} title={crit ? 'Resolve critical issues first' : ''} onClick={async () => { if (await act('deposit.closeScrutiny', { depId: d.id })) toast('Scrutiny marked complete.'); }}><ShieldCheck aria-hidden />Mark scrutiny complete</button>}
  </>;
  if (user.role === 'institution') return <>
    {(l === 'Expiring' || l === 'Matured') && !d.release && <button className="btn primary" onClick={() => nav('renew', d.id)}><RefreshCcw aria-hidden />Renew or replace</button>}
    {(l === 'Matured' || l === 'Expiring' || inst(s, d).status !== 'Active') && !d.release && <button className="btn" onClick={() => nav('release', d.id)}><FileText aria-hidden />Request release</button>}
  </>;
  if (user.role === 'bank' && (d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker')) return <button className="btn primary" onClick={() => nav('desk', d.id)}><Inbox aria-hidden />Open in confirmation desk</button>;
  return null;
}
const inst = (s: ReturnType<typeof useApp>['s'], d: Deposit) => instOf(s, d.instId);

function Lifecycle({ d }: { d: Deposit }) {
  const { s } = useApp(); const t = today(s); const l = life(d, s, t);
  const verified = d.verification === 'Verified'; const bad = d.verification === 'Mismatch' || d.verification === 'Not found';
  const left = diffDays(effMaturity(d), t);
  const steps = [
    { k: 'Submitted', sub: fmtDate(d.submittedOn), st: 'done', ic: Upload },
    { k: 'Bank verification', sub: verified ? `Confirmed ${fmtDate(d.confirmed?.on)}` : d.verification, st: verified ? 'done' : bad ? 'bad' : 'cur', ic: bad ? AlertTriangle : BadgeCheck },
    { k: 'Valid and tracked', sub: verified ? (left >= 0 ? `${left} days to maturity` : 'Term over') : 'After verification', st: verified ? (left >= 0 && l !== 'Renewed' && l !== 'Released' ? 'cur' : 'done') : '', ic: BellRing },
    { k: 'Maturity', sub: fmtDate(effMaturity(d)), st: left < 0 ? 'done' : '', ic: CalendarClock },
    { k: d.replacedBy ? 'Renewed' : 'Released or renewed', sub: d.replacedBy ? `Replaced by ${d.replacedBy}` : d.release ? `Release: ${d.release.status}` : '—', st: l === 'Renewed' || l === 'Released' ? 'done' : d.release ? 'cur' : '', ic: FileCheck2 },
  ];
  return <div className="panel" style={{ padding: '22px 16px 18px', marginBottom: 16 }}><div className="cps">{steps.map(x => <div key={x.k} className={cls('cp', x.st)}><span className="dot2">{x.st === 'done' ? <Check aria-hidden /> : <x.ic aria-hidden />}</span><div><b>{x.k}</b><br /><span>{x.sub}</span></div></div>)}</div></div>;
}

function RiskSignal({ d }: { d: Deposit }) {
  const { s } = useApp(); const r = useMemo(() => anomalyScores(s).get(d.id), [s, d.id]);
  if (!r) return null;
  return (
    <Panel title="Unusual-pattern score" sub="Isolation Forest over amount, term, branch, timing and bank reply">
      <div className="col"><div className="riskmeter"><b style={{ font: '600 1.4rem var(--f-head)', color: 'var(--ink)' }}>{r.score}</b><div className="rb"><i style={{ left: `${Math.min(100, Math.max(0, (r.score - 30) / 50 * 100))}%` }} /></div></div>
        <span className="muted" style={{ fontSize: '.857rem' }}>{r.reasons.length ? `Stands out on: ${r.reasons.join(', ').toLowerCase()}.` : 'Looks like the other deposits in the register.'} A prompt to look, not a verdict.</span></div>
    </Panel>
  );
}

function Summary({ d }: { d: Deposit }) {
  const { s, user } = useApp(); const i = instOf(s, d.instId); const c = d.confirmed;
  const rows: [string, string, string | null, boolean][] = [
    ['Instrument number', d.number, c ? d.number : null, true],
    ['Bank and branch', `${d.bankName}${d.kind === 'FDR' ? ', ' + d.branch : ''}`, c ? c.by : null, true],
    ['Amount', inrFull(d.claimed.amountLakh), c ? inrFull(c.amountLakh) : null, !c || c.amountLakh === d.claimed.amountLakh],
    ['Date of issue', fmtDate(d.claimed.issue), c ? fmtDate(d.claimed.issue) : null, true],
    ['Date of maturity', fmtDate(d.claimed.maturity), c ? fmtDate(c.maturity) : null, !c || c.maturity === d.claimed.maturity],
    ['Lien to AICTE', 'Declared', c ? (c.lien ? 'Marked' : 'Not marked') : null, !c || c.lien],
  ];
  const isBank = user?.role === 'bank';
  const held = s.deposits.filter(x => x.instId === i.id && !x.replacedBy && !(x.release && x.release.status === 'Lien released') && x.verification === 'Verified').reduce((a, x) => a + (x.confirmed?.amountLakh || 0), 0);
  return (
    <div className="layout">
      <Panel className="s7" title={isBank ? 'Values confirmed by the bank' : 'Submitted vs bank-confirmed'} sub={isBank ? 'Institution figures are not shown to the bank so confirmation stays independent' : 'The portal never trusts the uploaded document alone. Each value is matched against the bank\'s own record.'} flush foot={c ? `Confirmed ${fmtDate(c.on)} via ${c.via}.` : undefined}>
        <div className="tw"><table className="cmp"><thead><tr><th>Field</th>{!isBank && <th>Submitted by institution</th>}<th>Confirmed by {d.kind === 'FDR' ? 'bank' : 'gateway'}</th>{!isBank && <th>Result</th>}</tr></thead>
          <tbody>{rows.map(([k, a, b, ok]) => <tr key={k} className={!ok ? 'mis' : ''}><td>{k}</td>{!isBank && <td>{a}</td>}<td>{b ?? <span className="faint">Awaiting</span>}</td>{!isBank && <td>{b == null ? <Badge tone="info">Pending</Badge> : ok ? <Badge tone="good" icon>Match</Badge> : <Badge tone="bad" icon>Mismatch</Badge>}</td>}</tr>)}</tbody></table></div>
      </Panel>
      <div className="s5 col" style={{ alignContent: 'start' }}>
        {!isBank && <Panel title="Institution">
          <dl className="kv"><dt>Name</dt><dd>{i.name}</dd><dt>AICTE Permanent ID</dt><dd className="mono">{i.aicteId}</dd><dt>Region</dt><dd>{i.region} Regional Office</dd><dt>Status</dt><dd>{i.status}{i.openComplaints ? ` · ${i.openComplaints} open complaint(s)` : ''}</dd><dt>Required deposit</dt><dd>{inr(i.requiredLakh)}{i.leased ? ' (doubled: leased building)' : ''}</dd><dt>Held, verified</dt><dd style={{ color: held < i.requiredLakh ? 'var(--bad)' : undefined }}>{inr(held)}</dd></dl>
        </Panel>}
        {user?.role === 'officer' && d.kind === 'FDR' && <RiskSignal d={d} />}
        <Panel title="Custody and release">
          <dl className="kv">
            <dt>Original</dt><dd>{d.custody ? `${d.custody.state} · locker ${d.custody.locker} since ${fmtDate(d.custody.since)}${d.custody.reason ? ` (${d.custody.reason})` : ''}` : 'Online payment, no paper original'}</dd>
            <dt>Release</dt><dd>{d.release ? `${d.release.status} · requested ${fmtDate(d.release.requestedOn)}` : 'No request'}</dd>
            {d.replaces && <><dt>Replaces</dt><dd className="mono">{d.replaces}</dd></>}
            {d.replacedBy && <><dt>Replaced by</dt><dd className="mono">{d.replacedBy}</dd></>}
          </dl>
          {d.release && d.release.status === 'Requested' && !isBank && <><hr className="sep" /><div className="sectitle">Release conditions</div><Checks items={releaseChecks(d, s)} /></>}
        </Panel>
      </div>
    </div>
  );
}

function Docs({ d, open }: { d: Deposit; open: (m: { doc: Doc; mode: 'view' | 'check' }) => void }) {
  const { s, user, act, upload: send, toast } = useApp();
  const [kind, setKind] = useState<Doc['kind']>('Affidavit');
  const upload = async (f: File) => {
    try {
      const up = await send(new Uint8Array(await f.arrayBuffer()), f.type || 'application/pdf', f.name);
      if (await act('deposit.addDoc', { depId: d.id, fileId: up.id, name: f.name, kind })) toast(`${f.name} uploaded, encrypted and fingerprinted.`);
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  return (
    <Panel title="Documents" sub="Every file is stored with its SHA-256 fingerprint. Any later change to the file is detected." flush
      actions={user?.role !== 'bank' ? <div className="row"><select className="input" style={{ width: 'auto' }} value={kind} onChange={e => setKind(e.target.value as Doc['kind'])} aria-label="Document type"><option>Affidavit</option><option>FDR</option><option>Release request letter</option><option>Bank confirmation</option></select><label className="btn primary sm"><FileUp aria-hidden />Upload<input type="file" hidden accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></label></div> : undefined}>
      <div className="tw"><table className="t"><thead><tr><th>Document</th><th>Uploaded</th><th>SHA-256 fingerprint</th><th>Integrity</th><th /></tr></thead>
        <tbody>{d.docs.map(doc => { const tampered = doc.kind === 'FDR' && d.hashCurrent !== d.hashStored; return <tr key={doc.id}>
          <td><div className="nm">{doc.name}</div><div className="s2">{doc.kind} · {doc.sizeKb} KB</div></td>
          <td><div>{fmtDate(doc.uploadedOn)}</div><div className="s2">{doc.by}</div></td>
          <td><span className="hash">{doc.sha256.slice(0, 24)}…</span></td>
          <td>{tampered ? <Badge tone="bad" icon>Altered</Badge> : <Badge tone="good" icon>Intact</Badge>}</td>
          <td className="r nowrap"><button className="btn sm" onClick={() => open({ doc, mode: 'view' })}><Eye aria-hidden />View</button> <button className="btn sm" onClick={() => open({ doc, mode: 'check' })}><Fingerprint aria-hidden />Check a copy</button></td>
        </tr>; })}</tbody></table></div>
      {!d.affidavit && <div className="pf" style={{ color: 'var(--warn)' }}>Affidavit is missing for this deposit.</div>}
      <span hidden>{s.version}</span>
    </Panel>
  );
}

function DocModal({ d, doc, mode, close }: { d: Deposit; doc: Doc; mode: 'view' | 'check'; close: () => void }) {
  const { act } = useApp();
  const { file, err } = useDocFile(doc, d);
  const [res, setRes] = useState<null | { ok: boolean; h: string }>(null);
  const check = (h: string) => { const ok = h === doc.sha256; setRes({ ok, h }); void act('audit.log', { action: `Integrity check on ${doc.name}: ${ok ? 'matches' : 'does not match'}`, ref: d.id }, { quiet: true }); };
  return (
    <Modal title={doc.name} sub={`${doc.kind} · uploaded ${fmtDate(doc.uploadedOn)} by ${doc.by}`} onClose={close} width={mode === 'view' ? 760 : 620}>
      {mode === 'view' ? <>{file ? <PdfView bytes={file.bytes} mime={file.mime} width={680} /> : <div className="empty">{err || 'Loading the document…'}</div>}<div className="hash" style={{ marginTop: 10 }}>SHA-256 {doc.sha256}</div></> : (
        <div className="col">
          <p>Upload the copy you have. The portal computes its SHA-256 fingerprint and compares it with the one stored when the document was first submitted.</p>
          <div className="hash">Stored: {doc.sha256}</div>
          <div className="row">
            <label className="btn primary"><FileUp aria-hidden />Upload a copy<input type="file" hidden accept="application/pdf,image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) check(sha256(new Uint8Array(await f.arrayBuffer()))); }} /></label>
            <button className="btn" onClick={() => check(doc.sha256)}>Try the original</button>
            <button className="btn danger" onClick={() => check(sha256(doc.sha256 + 'edited'))}>Try an edited copy</button>
          </div>
          {res && (res.ok ? <div className="verdict good"><b>Identical to the submitted file</b><span className="hash">{res.h}</span></div> : <div className="verdict bad"><b>Different from the submitted file</b><span>Even a one-character edit changes the fingerprint. <span className="hash">{res.h}</span></span></div>)}
        </div>)}
    </Modal>
  );
}

function History({ d }: { d: Deposit }) {
  const { s, nav } = useApp();
  const chain: Deposit[] = []; let cur: Deposit | undefined = d;
  while (cur?.replaces) cur = s.deposits.find(x => x.id === cur!.replaces);
  while (cur) { chain.push(cur); cur = cur.replacedBy ? s.deposits.find(x => x.id === cur!.replacedBy) : undefined; }
  const events = s.audit.filter(a => a.ref === d.id).slice().reverse();
  const moves = s.vault.filter(v => v.depId === d.id);
  return (
    <div className="layout">
      <Panel className="s5" title="Renewal and replacement history" sub="Each instrument this deposit has passed through" flush>
        <div className="list">{chain.map((x, k) => <button key={x.id} className="li" onClick={() => nav('deposit', x.id)} aria-current={x.id === d.id}><span className={`mark ${x.id === d.id ? 'info' : ''}`} /><div><div className="ttl mono">{x.number}{x.id === d.id && <span className="faint" style={{ fontFamily: 'var(--f-sans)', fontWeight: 400 }}> (this record)</span>}</div><div className="meta">{x.bankName} · {fmtDate(x.claimed.issue)} to {fmtDate(effMaturity(x))} · {inr(x.claimed.amountLakh)}</div></div><span className="faint">{k === 0 ? 'Original' : `Renewal ${k}`}</span></button>)}</div>
      </Panel>
      <Panel className="s7" title="Activity on this record" flush>
        <div className="list">
          {events.map(a => <div key={a.seq} className="li"><span className="mark info" /><div><div className="ttl" style={{ fontWeight: 500 }}>{a.action}</div><div className="meta">{a.actor} · {fmtDateTime(a.at)} · <span className="hash">#{a.seq} {a.hash.slice(0, 10)}…</span></div></div><span /></div>)}
          {moves.map((v, k) => <div key={'v' + k} className="li"><span className="mark" /><div><div className="ttl" style={{ fontWeight: 500 }}>Vault: {v.action} ({v.locker})</div><div className="meta">{v.by} · {fmtDate(v.at)} · {v.reason}</div></div><span /></div>)}
          {!events.length && !moves.length && <div className="empty">No recorded activity in the audit window.</div>}
        </div>
      </Panel>
    </div>
  );
}

function Notes({ d }: { d: Deposit }) {
  const { user, act, toast } = useApp();
  const kinds: Note['kind'][] = user?.role === 'officer' ? ['Observation', 'Discrepancy notice'] : user?.role === 'institution' ? ['Institution reply'] : ['Bank remark'];
  const [k, setK] = useState<Note['kind']>(kinds[0]); const [txt, setTxt] = useState('');
  const add = async () => {
    if (!txt.trim()) return;
    if (!(await act('deposit.addNote', { depId: d.id, kind: k, text: txt.trim() }))) return;
    setTxt(''); toast(k === 'Discrepancy notice' ? 'Notice sent to the institution by email and SMS.' : 'Note recorded.');
  };
  return (
    <div className="layout">
      <Panel className="s7" title="Scrutiny notes" sub="Observations, notices and replies, in order" flush>
        <div className="list">{d.notes.slice().reverse().map(n => <div key={n.id} className="li"><span className={`mark ${n.kind === 'Discrepancy notice' ? 'bad' : n.kind === 'Institution reply' ? 'good' : 'info'}`} /><div><div className="ttl" style={{ fontWeight: 500 }}>{n.text}</div><div className="meta">{n.kind} · {n.by} · {fmtDate(n.on)}</div></div><span /></div>)}{!d.notes.length && <div className="empty">No notes yet.</div>}</div>
      </Panel>
      <Panel className="s5" title="Add a note">
        <div className="col">
          <Field label="Type"><select className="input" value={k} onChange={e => setK(e.target.value as Note['kind'])}>{kinds.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Note" hint={k === 'Discrepancy notice' ? 'The institution is notified by email and SMS.' : undefined}><textarea className="input" rows={4} value={txt} onChange={e => setTxt(e.target.value)} /></Field>
          <button className="btn primary" onClick={add} disabled={!txt.trim()}><CheckCircle2 aria-hidden />Save note</button>
        </div>
      </Panel>
    </div>
  );
}

function EditFields({ d, close }: { d: Deposit; close: () => void }) {
  const { act, toast } = useApp();
  const [branch, setBranch] = useState(d.branch); const [locker, setLocker] = useState(d.custody?.locker || ''); const [reason, setReason] = useState('');
  return (
    <Modal title="Edit permitted fields" sub="Financial values come only from the bank and cannot be edited. Every change is written to the audit trail." onClose={close} width={520}
      foot={<><button className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={!reason.trim()} onClick={async () => { if (await act('deposit.editFields', { depId: d.id, branch, locker, reason })) { toast('Changes saved and logged.'); close(); } }}>Save changes</button></>}>
      <div className="col">
        <Field label="Branch name"><input className="input" value={branch} onChange={e => setBranch(e.target.value)} /></Field>
        {d.custody && <Field label="Locker"><input className="input mono" value={locker} onChange={e => setLocker(e.target.value)} /></Field>}
        <Field label="Reason for change" hint="Required"><input className="input" value={reason} onChange={e => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function NoticeModal({ d, close }: { d: Deposit; close: () => void }) {
  const { s, act, toast } = useApp(); const flags = flagsOf(d, s).filter(f => f.sev !== 'info');
  const [txt, setTxt] = useState(flags.length ? `Please resolve: ${flags.map(f => f.title.toLowerCase()).join('; ')}. Submit a corrected or replacement instrument within 15 days.` : '');
  return (
    <Modal title="Raise a notice to the institution" sub={instOf(s, d.instId).name} onClose={close} width={560}
      foot={<><button className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={!txt.trim()} onClick={async () => { if (await act('deposit.addNote', { depId: d.id, kind: 'Discrepancy notice', text: txt })) { toast('Notice sent by email and SMS. The institution sees it on its dashboard.'); close(); } }}><Send aria-hidden />Send notice</button></>}>
      <Field label="Notice text"><textarea className="input" rows={5} value={txt} onChange={e => setTxt(e.target.value)} data-autofocus /></Field>
    </Modal>
  );
}
