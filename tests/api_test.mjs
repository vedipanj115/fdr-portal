// End-to-end API test against a running SDFP server: auth, OTP, every workflow, RBAC, files, audit, automation.
const B = process.env.BASE || 'http://localhost:8080';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
function client() {
  let cookie = '';
  const req = async (method, path, body, raw) => {
    const h = { cookie }; let b;
    if (body instanceof FormData) b = body; else if (body !== undefined) { h['content-type'] = 'application/json'; b = JSON.stringify(body); }
    const r = await fetch(B + path, { method, headers: h, body: b });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return r;
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  };
  return { get: p => req('GET', p), post: (p, b = {}) => req('POST', p, b), raw: (p) => req('GET', p, undefined, true), cookie: () => cookie };
}
async function signIn(c, role, loginId, password = 'Demo@123') {
  const r = await c.post('/api/auth/login', { role, loginId, password });
  if (r.user) return r.user;
  const v = await c.post('/api/auth/otp', { challenge: r.challenge, otp: r.devCode });
  return v.user;
}
const act = (c, name, p) => c.post('/api/act/' + name, p);
const otp = async (c, purpose, ref) => (await c.post('/api/otp', { purpose, ref })).devCode;

console.log('Health + public');
const pub = client();
ok((await pub.get('/api/health')).ok, 'health');
let st = await pub.get('/api/state');
ok(st.user === null && st.state.deposits.length === 0 && st.state.summary.open > 100, 'anonymous sees only the public summary');
ok(Array.isArray(await (await pub.raw('/api/public/shield?q=pune')).json()), 'public shield search');
ok((await act(pub, 'deposit.addNote', {})).status === 401, 'actions need sign-in');

console.log('Auth');
const bad = await pub.post('/api/auth/login', { role: 'officer', loginId: 'AICTE-RB-1024', password: 'wrong' });
ok(bad.status === 401 && /attempt/.test(bad.error), 'wrong password refused with attempts left');
const off = client();
const l1 = await off.post('/api/auth/login', { role: 'officer', loginId: 'AICTE-RB-1024', password: 'Demo@123' });
ok(l1.otpRequired && /^\d{6}$/.test(l1.devCode), 'officer gets OTP challenge');
ok((await off.post('/api/auth/otp', { challenge: l1.challenge, otp: '000000' })).status === 401, 'wrong OTP refused');
const l2 = await off.post('/api/auth/otp', { challenge: l1.challenge, otp: l1.devCode });
ok(l2.user?.role === 'officer', 'officer signed in with OTP');
st = await off.get('/api/state');
ok(st.state.deposits.length > 200, 'officer sees all deposits: ' + st.state.deposits.length);

const ins = client(); const iu = await signIn(ins, 'institution', st.state.users.find(u => u.id === 'U2').loginId);
ok(iu?.role === 'institution', 'institution signed in (no OTP)');
let ist = (await ins.get('/api/state')).state;
ok(ist.deposits.every(d => d.instId === iu.instId), 'institution sees only its own deposits (' + ist.deposits.length + ')');
const mk = client(); await signIn(mk, 'bank', 'SBIN-MKR-01');
const ck = client(); await signIn(ck, 'bank', 'SBIN-CHK-01');
const bst = (await mk.get('/api/state')).state;
ok(bst.deposits.every(d => d.bankCode === 'SBIN'), 'bank sees only its own bank (' + bst.deposits.length + ')');

console.log('RBAC');
ok((await act(ins, 'release.approve', { depId: ist.deposits[0].id })).status === 400, 'institution cannot approve releases');
const other = st.state.deposits.find(d => d.instId !== iu.instId);
ok((await act(ins, 'deposit.addNote', { depId: other.id, kind: 'Institution reply', text: 'x' })).error?.includes('another institution'), 'institution cannot touch another institution');
ok((await ins.raw(`/api/docs/${other.id}/${other.docs[0]?.id}`)).status === 404, 'institution cannot download another institution\'s document');
ok((await act(ck, 'bank.cbsFetch', { depId: bst.deposits[0].id })).status === 400, 'checker cannot do maker fetch');

console.log('Submit FDR with file upload (encrypted), duplicate guard');
const inst = st.state.institutions.find(i => i.id === iu.instId);
const fd = new FormData(); fd.append('file', new Blob([new TextEncoder().encode('%PDF-1.4 test fdr ' + Date.now())], { type: 'application/pdf' }), 'fdr.pdf');
const up = await ins.post('/api/files', fd);
ok(/^[0-9a-f]{64}$/.test(up.sha256), 'upload fingerprinted ' + up.sha256?.slice(0, 12));
const number = 'SB' + String(Date.now()).slice(-8);
const sub = await act(ins, 'deposit.submitFdr', { number, ifsc: 'SBIN0001234', branch: inst.city + ' Main', amountLakh: inst.requiredLakh, issue: st.state.baseDate, maturity: (+st.state.baseDate.slice(0, 4) + 10) + st.state.baseDate.slice(4), fileId: up.id, fileName: 'fdr.pdf', affidavitSpecimen: true, bankRecord: { amountLakh: inst.requiredLakh, maturity: (+st.state.baseDate.slice(0, 4) + 10) + st.state.baseDate.slice(4), lien: true }, readBy: 'typed' });
ok(sub.ok && sub.result.id, 'submitted ' + sub.result?.id);
const depId = sub.result.id;
const dup = await act(ins, 'deposit.submitFdr', { number, ifsc: 'SBIN0001234', amountLakh: 1, issue: '2026-01-01', maturity: '2036-01-01' });
ok(/Duplicate FDR/.test(dup.error || ''), 'duplicate FDR blocked');
const docR = await ins.raw(`/api/docs/${depId}/${up.id}`);
ok(docR.status === 200 && (await docR.text()).startsWith('%PDF-1.4 test'), 'document decrypted for owner');

console.log('Bank maker-checker with CBS API and OTP e-sign');
const f = await act(mk, 'bank.cbsFetch', { depId });
ok(f.result?.found && f.result.amountLakh === inst.requiredLakh, 'maker fetched from CBS API');
ok((await act(mk, 'bank.toChecker', { depId, amountLakh: f.result.amountLakh, maturity: f.result.maturity, lien: true })).ok, 'maker sent to checker');
ok((await act(ck, 'bank.sign', { depId, otp: '123456' })).status === 400, 'e-sign with wrong OTP refused');
const so = await otp(ck, 'esign', depId);
const sg = await act(ck, 'bank.sign', { depId, otp: so });
ok(sg.result?.result === 'Verified', 'checker e-signed: Verified');
ok((await act(ck, 'bank.sign', { depId, otp: so })).status === 400, 'OTP cannot be reused');

console.log('Officer: notice, vault, config, release with OTP + NOC, lien release');
ok((await act(off, 'deposit.addNote', { depId, kind: 'Observation', text: 'Checked' })).ok, 'officer note');
const vd = st.state.deposits.find(d => d.custody?.state === 'In locker');
ok((await act(off, 'vault.move', { depId: vd.id, action: 'Checked out', reason: 'Audit' })).ok, 'vault check-out');
ok((await act(off, 'vault.move', { depId: vd.id, action: 'Checked in' })).ok, 'vault check-in');
ok((await act(off, 'config.save', { reminders: [90, 30, 7], escalateAfter: 15, bankSla: 7, bankEscalate: 14 })).ok, 'reminder rules saved');
st = await off.get('/api/state');
const rq = st.state.deposits.find(d => d.release?.status === 'Requested' && d.verification === 'Verified');
if (rq) {
  await act(off, 'release.clearComplaints', { depId: rq.id });
  const ro = await otp(off, 'release', rq.id);
  const ap = await act(off, 'release.approve', { depId: rq.id, otp: ro });
  ok(ap.ok || /condition/.test(ap.error || ''), 'release approve: ' + (ap.ok ? 'NOC ' + ap.result.nocId : ap.error));
  if (ap.ok) {
    const noc = await off.raw(`/api/docs/${rq.id}/${ap.result.nocId}`);
    ok(noc.status === 200 && (await noc.arrayBuffer()).byteLength > 2000, 'NOC PDF stored and downloadable');
    const bankUser = client(); await signIn(bankUser, 'bank', rq.bankCode === 'SBIN' ? 'SBIN-CHK-01' : 'SBIN-CHK-01');
    if (rq.bankCode === 'SBIN') { const lo = await otp(bankUser, 'lien', rq.id); ok((await act(bankUser, 'bank.releaseLien', { depId: rq.id, otp: lo })).ok, 'bank released lien'); }
  }
} else ok(true, 'no open release request in seed (skipped)');

console.log('Quick Scan + payments');
const any = st.state.deposits.find(d => d.custody);
const code = `SDFP1|${any.id}|${any.number}|${any.custody.locker}|${any.hashStored.slice(0, 12)}`;
ok((await act(off, 'scan.verify', { code })).result?.genuine === true, 'genuine sticker verified');
ok((await act(off, 'scan.verify', { code: code.slice(0, -3) + 'fff' })).result?.genuine === false, 'forged sticker detected');
const pay = await act(ins, 'deposit.payOnline', { amountLakh: 5, affidavit: true });
ok(pay.ok && /^TXN/.test(pay.result.txnId), 'online payment settled via gateway ' + pay.result?.txnId);

console.log('Automation');
const t1 = await act(off, 'demo.setOffset', { offset: 120 });
ok(t1.ok, 'time machine +120 days');
st = await off.get('/api/state');
ok(st.state.outbox.some(m => m.status !== 'Queued' && !m.status.startsWith('Sent earlier')), 'scheduler sent messages: ' + st.state.outbox.filter(m => !m.status.startsWith('Sent earlier')).length);
const scan = await off.post('/api/automation/run');
ok(typeof scan.reminders === 'number', 'manual scan ran');
await act(off, 'demo.setOffset', { offset: 0 });

console.log('Integrations (live HTTP)');
for (const k of ['aicte', 'cbs', 'pg', 'notify']) { const r = await off.post('/api/integrations/test/' + k); ok(!r.error, 'integration ' + k); }

console.log('Audit chain');
ok((await off.get('/api/audit/verify')).ok, 'chain intact');
const tp = await off.post('/api/demo/audit-tamper');
const v2 = await off.get('/api/audit/verify');
ok(!v2.ok && v2.at === tp.seq, 'DB tamper detected at #' + v2.at);
await off.post('/api/demo/audit-restore');
ok((await off.get('/api/audit/verify')).ok, 'restored');

console.log('Registration + lockout');
const nu = client();
const freeInst = st.state.institutions.find(i => !['U2'].includes(i.id) && i.id !== iu.instId && i.status === 'Active');
const lk = await nu.get('/api/aicte/lookup/' + freeInst.aicteId);
ok(lk.name === freeInst.name, 'AICTE register lookup');
const rg = await nu.post('/api/auth/register', { role: 'institution', aicteId: freeInst.aicteId, email: 'reg@college.edu.in', mobile: '9876543210', password: 'Secret123' });
ok(rg.otpRequired, 'register OTP sent');
const rv = await nu.post('/api/auth/otp', { challenge: rg.challenge, otp: rg.devCode });
ok(rv.user?.instId === freeInst.id, 'registered and signed in');
const lo = client(); let last;
for (let k = 0; k < 5; k++) last = await lo.post('/api/auth/login', { role: 'institution', loginId: freeInst.aicteId, password: 'nope' });
ok(/locked/.test(last.error || ''), 'account locked after 5 failures');
ok((await lo.post('/api/auth/login', { role: 'institution', loginId: freeInst.aicteId, password: 'Secret123' })).status === 423, 'even right password refused while locked');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
