import { useMemo, useState } from 'react';
import { Building2, Landmark, ShieldCheck, Search, LogIn, UserPlus, RefreshCw, KeyRound, Database, ScanText, BadgeCheck, BellRing, RefreshCcw, FileCheck2, QrCode, Fingerprint, Lock, Megaphone, Upload } from 'lucide-react';
import { useApp, type OtpInfo } from '../lib/store';
import type { Deposit, Role, User } from '../lib/types';
import { BANKS, REGIONS } from '../lib/data';
import { summaryOf, today } from '../lib/rules';
import { addYears, fmtDate, inrCr, pct } from '../lib/util';
import { Field, OtpBox } from '../components/ui';
import { qrDataUrl, stickerCode } from '../lib/qr';
import { CountText, CountUp, Pipeline, Reveal, useTilt } from '../components/fx';
import { GovChrome, GovFooter } from '../components/Chrome';

const ROLES: { id: Role; label: string; short: string; icon: typeof Building2; blurb: string; idLabel: string }[] = [
  { id: 'institution', label: 'Institution', short: 'Colleges and their Trusts', icon: Building2, blurb: 'Submit FDRs or pay online, renew, track status and request release.', idLabel: 'AICTE Permanent ID' },
  { id: 'officer', label: 'AICTE Officer', short: 'Regulation Bureau and ROs', icon: ShieldCheck, blurb: 'Scrutinise, verify, track maturities, approve releases and run reports.', idLabel: 'Employee ID' },
  { id: 'bank', label: 'Bank', short: 'Branch maker and checker', icon: Landmark, blurb: 'Confirm FDRs and liens from core banking, release liens after NOC.', idLabel: 'Bank user ID' },
];
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCap = () => Array.from({ length: 5 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');

function Captcha({ code }: { code: string }) {
  return (
    <svg width="120" height="38" viewBox="0 0 120 38" role="img" aria-label={`Captcha code ${code.split('').join(' ')}`}>
      <path d="M0 26 C 30 8, 60 34, 120 12" stroke="#b9b3a0" fill="none" /><path d="M0 12 C 40 30, 80 2, 120 28" stroke="#c9c2ad" fill="none" />
      {code.split('').map((c, i) => <text key={i} x={12 + i * 21} y={27} fontFamily="IBM Plex Mono, monospace" fontSize="20" fontWeight="600" fill="#2d3a4f" transform={`rotate(${(i % 2 ? 9 : -8)} ${18 + i * 21} 20)`}>{c}</text>)}
    </svg>
  );
}

function Guilloche() {
  // concentric rosette like the security print on a deposit receipt
  const rings = Array.from({ length: 26 }, (_, k) => {
    const r = 120 + k * 16, n = 18, pts: string[] = [];
    for (let a = 0; a <= 360; a += 3) { const t = (a * Math.PI) / 180; const rr = r + 9 * Math.sin(n * t + k * 0.5); pts.push(`${(980 + rr * Math.cos(t)).toFixed(1)},${(140 + rr * Math.sin(t)).toFixed(1)}`); }
    return <polyline key={k} points={pts.join(' ')} fill="none" stroke="rgba(190,210,255,.13)" strokeWidth="1" />;
  });
  return <svg className="gl" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{rings}</svg>;
}

const SAMPLE = (t: string) => ({ id: 'SAMPLE', instId: '', kind: 'FDR', number: '38104472915', bankCode: 'SBIN', bankName: 'State Bank of India', ifsc: 'SBIN0001234', branch: 'Main', claimed: { amountLakh: 100, issue: addYears(t, -3), maturity: addYears(t, 7) }, verification: 'Verified', docs: [], notes: [], affidavit: true, hashStored: 'a3f9c2e07b41d8e6f15c0a92b7d3e481c6f2a09b5d7e3c18f4a6b2d9e0c7f153', hashCurrent: '' } as unknown as Deposit);

function Illustration() {
  const { s } = useApp();
  const d = s.deposits.find(x => x.kind === 'FDR' && x.verification === 'Verified' && !x.replacedBy && !x.release && x.bankCode === 'SBIN') || SAMPLE(s.baseDate);
  const ref = useTilt<HTMLDivElement>(10);
  return (
    <div className="ill tilt" aria-hidden="true" ref={ref}>
      <div className="cert">
        <div className="bk">{d.bankName}</div><div className="kd">FIXED DEPOSIT RECEIPT</div>
        <div className="seal">LIEN<br />AICTE</div>
        <dl><dt>FDR No.</dt><dd>{d.number}</dd><dt>Amount</dt><dd>₹{Math.round(d.claimed.amountLakh * 1e5).toLocaleString('en-IN')}</dd><dt>Issued</dt><dd>{fmtDate(d.claimed.issue)}</dd><dt>Matures</dt><dd>{fmtDate(d.claimed.maturity)}</dd><dt>In favour of</dt><dd style={{ fontFamily: 'var(--f-sans)' }}>Member Secretary, AICTE</dd></dl>
        <img src={qrDataUrl(stickerCode(d), 3)} alt="" />
      </div>
      <div className="card c1"><span className="ci" style={{ background: 'linear-gradient(135deg,#16b35c,#0f8a45)' }}><BadgeCheck /></span><div>Confirmed by the bank<small>Amount, maturity and lien match</small></div></div>
      <div className="card c2"><span className="ci" style={{ background: 'linear-gradient(135deg,#ff9a3c,#e8700a)' }}><BellRing /></span><div>Reminder scheduled<small>90 / 30 / 7 days before maturity</small></div></div>
      <div className="card c3"><span className="ci" style={{ background: 'linear-gradient(135deg,#7c4dff,#4c2bd1)' }}><Fingerprint /></span><div>Audit hash recorded<small className="mono">{d.hashStored.slice(0, 16)}…</small></div></div>
    </div>
  );
}

export default function Login() {
  const { s, login, verifyLogin, nav, toast } = useApp();
  const [role, setRole] = useState<Role>('institution');
  const [mode, setMode] = useState<'in' | 'up' | 'otp'>('in');
  const [id, setId] = useState(''); const [pw, setPw] = useState('');
  const [cap, setCap] = useState(newCap); const [capIn, setCapIn] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<OtpInfo | null>(null);
  const [q, setQ] = useState('');
  const st = useMemo(() => s.summary || summaryOf(s), [s]);
  const t = today(s);
  const r = ROLES.find(x => x.id === role)!;
  const demo = s.users.find(u => u.role === role && ['U1', 'U2', 'U3'].includes(u.id)) || { loginId: role === 'institution' ? '' : role === 'officer' ? 'AICTE-RB-1024' : 'SBIN-MKR-01', password: 'Demo@123' };

  const switchRole = (x: Role) => { setRole(x); setMode('in'); setErr(''); setId(''); setPw(''); setCapIn(''); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (capIn.trim().toUpperCase() !== cap) { setErr('The captcha code does not match. A new one has been shown.'); setCap(newCap()); setCapIn(''); return; }
    setBusy(true); const res = await login(role, id, pw); setBusy(false);
    if ('error' in res) { setErr(res.error); setCap(newCap()); setCapIn(''); return; }
    if ('otp' in res) { setPending(res.otp); setMode('otp'); return; }
    finish(res.user);
  };
  const finish = (u: User) => toast(`Signed in as ${u.name}`);
  const fillDemo = () => { setId(demo.loginId); setPw(demo.password || 'Demo@123'); setCapIn(cap); setErr(''); };

  const heldCr = inrCr(st.held);
  const verified = st.verified;
  const maturing = st.life.Expiring;

  const scrollLogin = () => document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const FEAT: [typeof Building2, string, string, string][] = [
    [Database, 'One central register', 'Every FDR and online deposit, institution-wise and instrument-wise, with documents and status in one place.', 'linear-gradient(135deg,#2f6bff,#1739a8)'],
    [ScanText, 'Reads the FDR for you', 'Upload a bank PDF, a scan or a phone photo. Details are read automatically, with OCR for images.', 'linear-gradient(135deg,#7c4dff,#4c2bd1)'],
    [BadgeCheck, 'Independent bank check', 'The issuing bank confirms amount, maturity and lien from core banking. A mismatch is flagged instantly.', 'linear-gradient(135deg,#16b35c,#0f8a45)'],
    [BellRing, 'Reminders before deadlines', 'Configurable 90 / 30 / 7-day reminders, and automatic escalation when nobody acts.', 'linear-gradient(135deg,#ff9a3c,#e8700a)'],
    [RefreshCcw, 'Renewal history', 'Renewed and replacement instruments are linked, so the full history of every deposit is kept.', 'linear-gradient(135deg,#0ea5b7,#0b7f8c)'],
    [FileCheck2, 'Release with NOC', 'Conditions are checked automatically; the competent authority approves with OTP and the NOC is generated.', 'linear-gradient(135deg,#e05ca0,#b83280)'],
    [QrCode, 'QR-tracked originals', 'Paper FDRs in Regional Office lockers carry QR stickers. Every check-in and check-out is logged.', 'linear-gradient(135deg,#475569,#1e293b)'],
    [Fingerprint, 'Tamper-evident trail', 'Documents are fingerprinted and every action is chained, so no record can be quietly changed.', 'linear-gradient(135deg,#ef4444,#b91c1c)'],
  ];
  const notices: [string, string, boolean][] = [
    [t, `Reminder schedule for maturing deposits is ${s.config.reminders.join(' / ')} days before maturity, followed by escalation ${s.config.escalateAfter} days after.`, true],
    [s.baseDate, `Bank confirmation desk available to ${Object.values(BANKS).filter(b => b.scheduled).length} scheduled banks. Institution figures are never shown to the bank, so confirmation stays independent.`, true],
    [s.baseDate, 'FDRs issued by co-operative societies and non-scheduled banks are not accepted as security deposit.', false],
    [s.baseDate, 'Institutions may now upload a phone photo of the FDR. The portal reads the details automatically; please check them before submitting.', false],
  ];
  return (
    <div className="app">
      <GovChrome right={<><nav className="gnav" aria-label="Site"><button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button><button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</button><button onClick={() => nav('shield')}>Check a college</button><button onClick={() => document.getElementById('notices')?.scrollIntoView({ behavior: 'smooth' })}>Notices</button></nav><button className="btn primary" onClick={scrollLogin}><LogIn aria-hidden />Sign in</button></>} />
      <div className="ticker"><div className="in"><b>What's new</b><div className="tk"><div className="track">{[0, 1].map(c => <span key={c} aria-hidden={c === 1}>{notices.map((n, i) => <span key={i}>{fmtDate(n[0])}: {n[1]}<i>●</i></span>)}</span>)}</div></div></div></div>
      <main id="main">
        <section className="split">
          <div className="lft">
            <Guilloche />
            <span className="pill-tag" style={{ alignSelf: 'flex-start' }}><b>SIH 2026</b>Problem statement SIH26265 · Smart Automation</span>
            <h1>Every security deposit. <span>Verified, tracked, on time.</span></h1>
            <p className="lead">Institutions submit once. Banks confirm independently. SDFP tracks every FDR from submission to release and keeps a tamper-evident record of every action.</p>
            <Illustration />
            <div className="lstats small">
              <div><b><CountUp value={st.open} /></b><span>deposits on record</span></div>
              <div><b><CountText text={heldCr} /></b><span>held, bank-verified</span></div>
              <div><b><CountUp value={pct(verified, st.open)} />%</b><span>confirmed by banks</span></div>
              <div><b><CountUp value={maturing} /></b><span>maturing in {Math.max(...s.config.reminders)} days</span></div>
            </div>
          </div>
          <div className="rgt" id="signin"><div className="inner">
            <div className="annc"><span className="ai"><Megaphone aria-hidden /></span><div><small>IMPORTANT · APPROVAL SEASON {+t.slice(0, 4) + 1}</small><b>Renew FDRs maturing between January and April {+t.slice(0, 4) + 1} by 31 December {t.slice(0, 4)}</b><span>Late renewals can delay refunds during the approval season. <button className="link" onClick={() => document.getElementById('notices')?.scrollIntoView({ behavior: 'smooth' })}>Read notices</button></span></div></div>
            <div><div className="hi muted" style={{ fontSize: '.9rem' }}>सुरक्षा जमा एवं एफडीआर पोर्टल में आपका स्वागत है</div><h2>{mode === 'up' ? 'Create your account' : mode === 'otp' ? "Verify it's you" : 'Sign in to SDFP'}</h2><p className="muted" style={{ marginTop: 4 }}>Choose your portal to continue.</p></div>
            <div className="rolepick" role="group" aria-label="Portal">{ROLES.map(p => <button key={p.id} aria-pressed={role === p.id} onClick={() => switchRole(p.id)}><span className="ic"><p.icon aria-hidden /></span><b>{p.label}</b><small>{p.short}</small></button>)}</div>
                  {mode === 'in' && (
                    <form className="col" onSubmit={submit}>
                      <div><div className="muted" style={{ fontSize: '.9rem' }}>{role === 'institution' ? 'Use the Permanent ID from your AICTE approval.' : 'A one-time password is sent to your registered mobile.'}</div></div>
                      <Field label={r.idLabel}><input className="input" value={id} onChange={e => setId(e.target.value)} autoComplete="username" required placeholder={role === 'institution' ? 'e.g. 1-4623177657' : role === 'officer' ? 'e.g. AICTE-RB-1024' : 'e.g. SBIN-MKR-01'} /></Field>
                      <Field label="Password"><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required /></Field>
                      <Field label="Enter the code shown">
                        <div className="captcha"><Captcha code={cap} /><button type="button" className="iconbtn" onClick={() => { setCap(newCap()); setCapIn(''); }} aria-label="New code"><RefreshCw /></button><input className="input" value={capIn} onChange={e => setCapIn(e.target.value)} required aria-label="Captcha" autoCapitalize="characters" /></div>
                      </Field>
                      {err && <div className="hint bad" role="alert">{err}</div>}
                      <button className="btn primary lg" type="submit" disabled={busy}><LogIn aria-hidden />{busy ? 'Signing in…' : 'Sign in'}</button>
                      <div className="row" style={{ justifyContent: 'space-between' }}><button type="button" className="link" onClick={() => toast('A password reset link has been sent to the registered email (demo).', 'info')}>Forgot password?</button><button type="button" className="link" onClick={() => { setMode('up'); setErr(''); }}>New user? Register</button></div>
                      <div className="demo"><span>Demo: <b className="mono">{demo.loginId}</b> / <b className="mono">{demo.password}</b></span><button type="button" className="btn sm" onClick={fillDemo}>Fill demo details</button></div>
                    </form>
                  )}
                  {mode === 'otp' && pending && (
                    <div className="col">
                      <div><h2>Verify it's you</h2><div className="muted" style={{ fontSize: '.9rem' }}>We sent a 6-digit code to your registered mobile. It expires in 5 minutes.</div></div>
                      <OtpBox info={pending} busyLabel="Verify and continue" onOk={async otp => { const res = await verifyLogin(pending.challenge!, otp); if ('error' in res) return res.error; if ('user' in res) finish(res.user); }} />
                      <button className="link" onClick={() => setMode('in')}>Back</button>
                    </div>
                  )}
                  {mode === 'up' && <SignUp role={role} onDone={u => finish(u)} onBack={() => setMode('in')} />}
            <div className="trust"><span><Lock aria-hidden />OTP for officers and banks</span><span><Fingerprint aria-hidden />Every action audit-logged</span><span><ShieldCheck aria-hidden />Encrypted connection</span></div>
          </div></div>
        </section>

        <section className="lsec alt" id="how"><div className="in">
          <div className="sechead"><span className="eyebrow">How it works</span><h2>From submission to release, in four steps</h2><p>Each step is done by the right person, and the portal checks the rules in between.</p></div>
          <div className="panel" style={{ padding: '22px 12px 12px', marginBottom: 22 }}><Pipeline stages={[
            { label: 'Submitted', sub: 'FDR uploaded or paid online', count: st.life.Pending + st.life.Active + st.life.Expiring, icon: Upload, color: '#2f6bff' },
            { label: 'Read and checked', sub: 'OCR, IFSC, RBI list, duplicates', count: st.total, icon: ScanText, color: '#7c4dff' },
            { label: 'Bank-verified', sub: 'Confirmed from core banking', count: st.totalVerified, icon: BadgeCheck, color: '#12a150' },
            { label: 'Tracked', sub: 'Reminders 90 / 30 / 7 days', count: st.life.Active + st.life.Expiring, icon: BellRing, color: '#ff8a1f' },
            { label: 'Released or renewed', sub: 'NOC issued, lien released', count: st.life.Released + st.life.Renewed, icon: FileCheck2, color: '#e05ca0' },
          ]} /></div>
          <div className="flow">
            {[['Submit', 'The institution uploads the FDR or pays online. Details are read from the document and checked against AICTE rules.', 'Institution'],
              ['Confirm', 'The issuing bank fetches the FDR from core banking. A maker prepares, a manager signs with OTP.', 'Bank'],
              ['Track', 'The portal watches validity and maturity, sends reminders and escalates anything left unresolved.', 'Automatic'],
              ['Release', 'Conditions are checked, the competent authority approves with OTP, the NOC is issued and the bank releases the lien.', 'AICTE officer']].map(([h, p, w], i) => <div key={h}><div className="no">{i + 1}</div><h3>{h}</h3><p>{p}</p><span className="who">{w}</span></div>)}
          </div>
        </div></section>

        <section className="lsec" id="features"><div className="in">
          <div className="sechead"><span className="eyebrow">What SDFP does</span><h2>Built for the Regulation Bureau, institutions and banks</h2><p>Covers every capability in the problem statement, plus the safeguards that stop fake or expired deposits slipping through.</p></div>
          <div className="feat">{FEAT.map(([I, h, p, g], k) => <Reveal key={h} delay={(k % 4) * 90}><div className="fcard"><div className="ic" style={{ background: g }}><I aria-hidden /></div><h3>{h}</h3><p>{p}</p></div></Reveal>)}</div>
        </div></section>

        <section className="lsec alt" id="notices"><div className="in layout">
          <div className="panel s7">
            <div className="ph"><div><h2>Notices and circulars</h2><div className="sub">Prototype notices</div></div></div>
            <div className="pb"><div className="notices">
              {notices.map(([d, txt, isNew], i) => <div key={i}><time>{d.slice(8, 10)}<small>{fmtDate(d).slice(3)}</small></time><p>{txt}{isNew && <span className="new">NEW</span>}</p></div>)}
            </div></div>
          </div>
          <div className="panel s5">
            <div className="ph"><div><h2>Check a college's deposit</h2><div className="sub">For students and parents</div></div></div>
            <div className="pb col">
              <p className="muted">See whether an AICTE-approved college has a valid security deposit. Amounts and bank details stay private.</p>
              <form className="row" onSubmit={e => { e.preventDefault(); nav('shield', q); }}>
                <div className="search" style={{ flex: 1, width: 'auto' }}><Search aria-hidden /><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="College name or city" aria-label="College name or city" /></div>
                <button className="btn primary" type="submit">Check</button>
              </form>
              <div className="hint" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><ShieldCheck width={18} style={{ color: 'var(--b600)', flex: 'none', marginTop: 2 }} aria-hidden /><span>A deposit protects students: if a college closes, AICTE can use it to safeguard their interests.</span></div>
            </div>
          </div>
        </div></section>
      </main>
      <GovFooter />
    </div>
  );
}

function SignUp({ role, onDone, onBack }: { role: Role; onDone: (u: User) => void; onBack: () => void }) {
  const { register, verifyLogin, lookupAicte, s } = useApp();
  const [f, setF] = useState<Record<string, string>>({ region: 'HQ', bank: 'SBIN', bankRole: 'maker' });
  const [err, setErr] = useState(''); const [step, setStep] = useState<'form' | 'otp'>('form');
  const [found, setFound] = useState<string>(''); const [sent, setSent] = useState<OtpInfo | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const lookup = async () => {
    const r = await lookupAicte(f.aicte || '');
    if ('error' in r) { setFound(''); setErr(r.error); return; }
    if (r.taken) { setFound(''); setErr('An account already exists for this institution. Sign in instead.'); return; }
    setErr(''); setFound(`${r.name}, ${r.city} (${r.region} Region)`);
  };
  const validate = () => {
    if (role === 'institution' && !found) return 'Fetch your institution details from the AICTE register first.';
    if (!f.email || !/^\S+@\S+\.\S+$/.test(f.email)) return 'Enter a valid email address.';
    if (!/^\d{10}$/.test(f.mobile || '')) return 'Enter a 10-digit mobile number.';
    if (role !== 'institution' && !(f.login || '').trim()) return 'Enter your user ID.';
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(f.pw || '')) return 'Password needs at least 8 characters with letters and numbers.';
    if (f.pw !== f.pw2) return 'Passwords do not match.';
    return '';
  };
  const start = async () => {
    setBusy(true);
    const r = await register({ role, aicteId: (f.aicte || '').trim(), loginId: (f.login || '').trim(), name: f.name, designation: f.desig, region: f.region, bankCode: f.bank, bankRole: f.bankRole as 'maker' | 'checker', email: f.email, mobile: f.mobile, password: f.pw });
    setBusy(false);
    if ('error' in r) { setErr(r.error); return; }
    if ('otp' in r) { setSent(r.otp); setStep('otp'); }
  };
  if (step === 'otp') return (
    <div className="col"><div><h2>Verify your mobile</h2><div className="muted">Code sent to the number ending {f.mobile.slice(-4)}.</div></div>
      <OtpBox info={sent!} busyLabel="Verify and create account" onOk={async otp => { const r = await verifyLogin(sent!.challenge!, otp); if ('error' in r) return r.error; if ('user' in r) onDone(r.user); }} /><button className="link" onClick={() => setStep('form')}>Back</button></div>
  );
  return (
    <form className="col" onSubmit={e => { e.preventDefault(); const v = validate(); if (v) { setErr(v); return; } setErr(''); void start(); }}>
      <div><h2>Register for the {role === 'officer' ? 'AICTE officer' : role} portal</h2><div className="muted" style={{ fontSize: '.929rem' }}>{role === 'institution' ? 'Your details are fetched from the AICTE approval register.' : role === 'officer' ? 'Officer accounts are approved by the Regulation Bureau administrator. In this demo, approval is instant.' : 'Each bank user is either a maker (prepares) or a checker (signs).'}</div></div>
      {role === 'institution' && <>
        <Field label="AICTE Permanent ID" hint={<>Try <span className="mono">{s.institutions.find(i => !s.users.some(u => u.instId === i.id))?.aicteId}</span></>}>
          <div className="row" style={{ flexWrap: 'nowrap' }}><input className="input" value={f.aicte || ''} onChange={e => { set('aicte')(e); setFound(''); }} required /><button type="button" className="btn" onClick={lookup}><KeyRound aria-hidden />Fetch</button></div>
        </Field>
        {found && <div className="hint good">{found}</div>}
      </>}
      {role === 'officer' && <div className="grid2">
        <Field label="Full name"><input className="input" value={f.name || ''} onChange={set('name')} required /></Field>
        <Field label="Employee ID"><input className="input" value={f.login || ''} onChange={set('login')} required /></Field>
        <Field label="Office"><select className="input" value={f.region} onChange={set('region')}><option value="HQ">Regulation Bureau (HQ)</option>{REGIONS.map(r => <option key={r.name} value={r.name}>{r.name} Regional Office, {r.office}</option>)}</select></Field>
        <Field label="Designation"><input className="input" value={f.desig || ''} onChange={set('desig')} placeholder="e.g. Assistant Director" /></Field>
      </div>}
      {role === 'bank' && <div className="grid2">
        <Field label="Bank"><select className="input" value={f.bank} onChange={set('bank')}>{Object.entries(BANKS).filter(([, b]) => b.scheduled).map(([c, b]) => <option key={c} value={c}>{b.name}</option>)}</select></Field>
        <Field label="Role"><select className="input" value={f.bankRole} onChange={set('bankRole')}><option value="maker">Branch officer (maker)</option><option value="checker">Branch manager (checker)</option></select></Field>
        <Field label="Full name"><input className="input" value={f.name || ''} onChange={set('name')} required /></Field>
        <Field label="User ID"><input className="input" value={f.login || ''} onChange={set('login')} required placeholder={`${f.bank}-MKR-02`} /></Field>
      </div>}
      <div className="grid2">
        <Field label="Email"><input className="input" type="email" value={f.email || ''} onChange={set('email')} required /></Field>
        <Field label="Mobile"><input className="input" inputMode="numeric" value={f.mobile || ''} onChange={set('mobile')} required maxLength={10} /></Field>
        <Field label="Password"><input className="input" type="password" value={f.pw || ''} onChange={set('pw')} required autoComplete="new-password" /></Field>
        <Field label="Confirm password"><input className="input" type="password" value={f.pw2 || ''} onChange={set('pw2')} required autoComplete="new-password" /></Field>
      </div>
      <div className="hint" style={{ fontSize: '.857rem' }}>This is a prototype. Do not use a real password.</div>
      {err && <div className="hint bad" role="alert">{err}</div>}
      <button className="btn primary lg" type="submit" disabled={busy}><UserPlus aria-hidden />{busy ? 'Sending OTP…' : 'Continue'}</button>
      <button type="button" className="link" onClick={onBack}>Already registered? Sign in</button>
    </form>
  );
}
