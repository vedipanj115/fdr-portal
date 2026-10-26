// AICTE SDFP server: REST API, authentication, role-based access, encrypted storage, automation scheduler.
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AppState, Deposit, User, Role } from '../src/lib/types';
import { ActionError, runAction, pushAudit, type Ctx } from '../src/lib/actions';
import { runScan } from '../src/lib/automation';
import { isOpen, life, stats, summaryOf, today } from '../src/lib/rules';
import { generatedDoc } from '../src/lib/docgen';
import { uid } from '../src/lib/util';
import { db, insertUser, loadState, saveDiff, seedIfEmpty, setOutboxStatus, tamperAuditRow, auditRows } from './db';
import { DATA_DIR, JWT_SECRET, decrypt, encrypt, randomCode, sha256hex, randomId } from './crypto';
import { mocks, MOCK_KEYS } from './mocks';
import { sha256 } from '../src/lib/util';

const PORT = +(process.env.PORT || 8080);
const DEMO = process.env.SDFP_DEMO !== 'false';           // demo conveniences: shown OTPs, user switcher, reset, time machine
const SELF = `http://127.0.0.1:${PORT}`;

seedIfEmpty();
let S: AppState = loadState();
let busy = Promise.resolve();                              // serialise writes so actions never interleave
const serial = <T,>(fn: () => Promise<T>) => { const p = busy.then(fn, fn); busy = p.then(() => undefined, () => undefined); return p; };

/* ---------- email (real SMTP if configured, otherwise a local outbox) ---------- */
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
  : nodemailer.createTransport({ jsonTransport: true });
async function deliver(state: AppState) {
  for (const m of (state.outbox || []).filter(o => o.status === 'Queued')) {
    try {
      if (m.channel === 'Email') { const to = /@/.test(m.to) ? m.to : (process.env.SDFP_FALLBACK_EMAIL || 'records@sdfp.local'); await mailer.sendMail({ from: process.env.SMTP_FROM || 'AICTE SDFP <no-reply@sdfp.local>', to, subject: m.subject, text: `${m.body}\n\nRef: ${m.ref || '-'}\nAICTE Streamlined Deposit & FDR Portal (prototype)` }); m.status = process.env.SMTP_HOST ? 'Sent' : 'Delivered to local outbox'; }
      else m.status = process.env.SMS_WEBHOOK ? 'Sent' : 'Delivered to local SMS log';
      if (m.channel === 'SMS' && process.env.SMS_WEBHOOK) await fetch(process.env.SMS_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: m.to, text: m.body }) });
    } catch (e) { m.status = 'Failed: ' + (e as Error).message.slice(0, 60); }
    setOutboxStatus(m.id, m.status);
  }
}

/* ---------- action context: the real implementations of files, bank, OTP, payment ---------- */
function makeCtx(state: AppState, user: User): Ctx {
  return {
    async saveFile(bytes, mime, name) { const id = randomId('F'); const sha = sha256hex(Buffer.from(bytes)); fs.writeFileSync(path.join(DATA_DIR, 'files', id + '.bin'), encrypt(Buffer.from(bytes))); db.prepare('INSERT INTO files(id, name, mime, size, sha256, owner, created) VALUES(?,?,?,?,?,?,?)').run(id, name, mime, bytes.length, sha, user.id, new Date().toISOString()); return { id, sha256: sha, sizeKb: Math.max(1, Math.round(bytes.length / 1024)) }; },
    async fileInfo(id) { const r = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as { sha256: string; size: number; mime: string; owner: string } | undefined; if (!r || (r.owner !== user.id && user.role !== 'officer')) return null; return { sha256: r.sha256, sizeKb: Math.max(1, Math.round(r.size / 1024)), mime: r.mime }; },
    async cbsLookup(number, ifsc) { const r = await fetch(`${SELF}/mock/cbs/v1/fdr?number=${encodeURIComponent(number)}&ifsc=${encodeURIComponent(ifsc)}`, { headers: { 'x-api-key': MOCK_KEYS.cbs } }); const j = await r.json() as { found: boolean; amount?: number; maturity_date?: string; lien_marked_to?: string | null; holder?: string }; return j.found ? { found: true, amountLakh: j.amount! / 1e5, maturity: j.maturity_date, lien: !!j.lien_marked_to, holder: j.holder } : { found: false }; },
    async cbsRegister(rec) { if (!DEMO) return; await fetch(`${SELF}/mock/cbs/v1/fdr`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': MOCK_KEYS.cbs }, body: JSON.stringify(rec) }); },
    async verifyOtp(purpose, ref, otp) { return checkOtp(user.id, purpose, ref, otp); },
    async pay(amountLakh, ref) { const h = { 'content-type': 'application/json', 'x-api-key': MOCK_KEYS.pg }; const o = await (await fetch(`${SELF}/mock/pg/v1/orders`, { method: 'POST', headers: h, body: JSON.stringify({ amount: Math.round(amountLakh * 1e5), ref }) })).json() as { order_id: string }; const p = await (await fetch(`${SELF}/mock/pg/v1/orders/${o.order_id}/pay`, { method: 'POST', headers: h })).json() as { status: string; txn_id: string }; return { txnId: p.txn_id, settled: p.status === 'SETTLED' }; },
    notify(to, channel, subject, body, ref) { state.outbox ||= []; state.outbox.unshift({ id: uid('MSG'), at: today(state), channel, to, subject, body, ref, status: 'Queued' }); },
  };
}

/* ---------- OTPs (hashed, 5-minute expiry, 5 tries) ---------- */
function issueOtp(user: { id: string; mobile: string; name: string }, purpose: string, ref: string) {
  const code = randomCode();
  db.prepare('UPDATE otps SET used = 1 WHERE user_id = ? AND purpose = ? AND ref = ? AND used = 0').run(user.id, purpose, ref);
  db.prepare('INSERT INTO otps(user_id, purpose, ref, code_hash, expires) VALUES(?,?,?,?,?)').run(user.id, purpose, ref, sha256hex(code + user.id), Date.now() + 5 * 60_000);
  S.outbox ||= []; const m = { id: uid('MSG'), at: today(S), channel: 'SMS' as const, to: user.mobile, subject: 'One-time password', body: `Your SDFP OTP for ${purpose} is ${DEMO ? code : '******'}. Valid for 5 minutes.`, ref, status: 'Queued' };
  S.outbox.unshift(m); db.prepare('INSERT INTO outbox(id, at, channel, to_addr, subject, body, ref, status) VALUES(?,?,?,?,?,?,?,?)').run(m.id, m.at, m.channel, m.to, m.subject, m.body, m.ref, m.status); void deliver(S);
  return { to: '******' + user.mobile.slice(-4), devCode: DEMO ? code : undefined };
}
function checkOtp(userId: string, purpose: string, ref: string, code: string) {
  const r = db.prepare('SELECT * FROM otps WHERE user_id = ? AND purpose = ? AND ref = ? AND used = 0 ORDER BY id DESC LIMIT 1').get(userId, purpose, ref) as { id: number; code_hash: string; expires: number; tries: number } | undefined;
  if (!r || r.expires < Date.now() || r.tries >= 5) return false;
  if (r.code_hash !== sha256hex(code + userId)) { db.prepare('UPDATE otps SET tries = tries + 1 WHERE id = ?').run(r.id); return false; }
  db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(r.id); return true;
}

/* ---------- what each role is allowed to see ---------- */
function canSee(u: User, d: Deposit) { return u.role === 'officer' || (u.role === 'institution' && d.instId === u.instId) || (u.role === 'bank' && d.bankCode === u.bankCode); }
const demoUsers = () => (db.prepare("SELECT data_enc FROM users WHERE id IN ('U1','U2','U3','U4')").all() as { data_enc: string }[]);
function viewFor(u: User | null): AppState {
  const st = S; const summary = summaryOf(st);
  const users = (DEMO ? demoUsers().map(r => JSON.parse(decrypt(Buffer.from(r.data_enc, 'base64')).toString())) : []).map((x: User) => ({ ...x, password: DEMO ? 'Demo@123' : '' }));
  if (!u) return { ...st, deposits: [], users, audit: [], notices: [], vault: [], esign: [], outbox: [], summary };
  if (u.role === 'officer') return { ...st, users, summary };
  const deps = st.deposits.filter(d => canSee(u, d)); const ids = new Set(deps.map(d => d.id));
  return {
    ...st, deposits: deps, users, summary,
    audit: st.audit.filter(a => ids.has(a.ref) || a.actor === u.name),
    notices: st.notices.filter(n => n.to === u.role && (!n.instId || n.instId === u.instId) && (!n.bankCode || n.bankCode === u.bankCode)),
    vault: st.vault.filter(v => ids.has(v.depId)), esign: st.esign.filter(e => e.bankCode === u.bankCode),
    outbox: (st.outbox || []).filter(o => o.ref && ids.has(o.ref)).slice(0, 200),
  };
}

/* ---------- app ---------- */
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'blob:'], workerSrc: ["'self'", 'blob:'], imgSrc: ["'self'", 'data:', 'blob:'], styleSrc: ["'self'", "'unsafe-inline'"], fontSrc: ["'self'", 'data:'], connectSrc: ["'self'", 'blob:', 'data:'], mediaSrc: ["'self'", 'blob:'] } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/mock', mocks);
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } });

type AReq = Request & { user?: User };
function userById(id: string): User | null { const r = db.prepare('SELECT id, data_enc FROM users WHERE id = ?').get(id) as { data_enc: string } | undefined; return r ? { ...JSON.parse(decrypt(Buffer.from(r.data_enc, 'base64')).toString()), password: '' } : null; }
function session(req: AReq, _res: Response, next: NextFunction) { const t = req.cookies?.sdfp; if (t) { try { const p = jwt.verify(t, JWT_SECRET) as { uid: string }; req.user = userById(p.uid) || undefined; } catch { /* expired or invalid */ } } next(); }
const need = (...roles: Role[]) => (req: AReq, res: Response, next: NextFunction) => (!req.user ? res.status(401).json({ error: 'Please sign in.' }) : roles.length && !roles.includes(req.user.role) ? res.status(403).json({ error: 'Not allowed for your role.' }) : next());
function signIn(res: Response, u: User) { res.cookie('sdfp', jwt.sign({ uid: u.id, role: u.role }, JWT_SECRET, { expiresIn: '8h' }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600_000 }); }
app.use(session);
const audit = async (actor: string, role: User['role'] | 'system', action: string, ref = '') => serial(async () => { const before = structuredClone(S); pushAudit(S, actor, role, action, ref); saveDiff(before, S); });

app.get('/api/health', (_req, res) => res.json({ ok: true, demo: DEMO, db: 'sqlite', time: new Date().toISOString() }));
app.get('/api/state', (req: AReq, res) => res.json({ user: req.user || null, state: viewFor(req.user || null), demo: DEMO }));

/* ---------- authentication ---------- */
const challenges = new Map<string, { kind: 'login' | 'register'; userId?: string; reg?: User & { plain: string }; exp: number }>();
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const b = z.object({ role: z.enum(['officer', 'institution', 'bank']), loginId: z.string().min(1).max(60), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'Enter your ID and password.' });
  const r = db.prepare('SELECT * FROM users WHERE login_id = ? AND role = ?').get(b.data.loginId.trim(), b.data.role) as { id: string; password_hash: string; failed: number; locked_until: number } | undefined;
  if (!r) return res.status(401).json({ error: 'No account with that ID for this portal.' });
  if (r.locked_until > Date.now()) return res.status(423).json({ error: `Account locked after 5 failed attempts. Try again after ${new Date(r.locked_until).toLocaleTimeString('en-IN')}.` });
  if (!bcrypt.compareSync(b.data.password, r.password_hash)) {
    const f = r.failed + 1; db.prepare('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(f >= 5 ? 0 : f, f >= 5 ? Date.now() + 15 * 60_000 : 0, r.id);
    return res.status(401).json({ error: f >= 5 ? 'Too many failed attempts. The account is locked for 15 minutes.' : `Incorrect password. ${5 - f} attempt(s) left.` });
  }
  db.prepare('UPDATE users SET failed = 0 WHERE id = ?').run(r.id);
  const u = userById(r.id)!;
  if (u.role === 'institution') { signIn(res, u); await audit(u.name, u.role, 'Signed in', u.loginId); return res.json({ user: u }); }
  const ch = randomId('CH'); challenges.set(ch, { kind: 'login', userId: u.id, exp: Date.now() + 5 * 60_000 });
  res.json({ otpRequired: true, challenge: ch, ...issueOtp(u, 'login', ch) });
});
app.post('/api/auth/otp', authLimiter, async (req, res) => {
  const { challenge, otp } = req.body || {}; const c = challenges.get(String(challenge));
  if (!c || c.exp < Date.now()) return res.status(400).json({ error: 'This code has expired. Start again.' });
  const uidv = c.kind === 'login' ? c.userId! : c.reg!.id;
  if (!checkOtp(uidv, c.kind, String(challenge), String(otp || ''))) return res.status(401).json({ error: 'That OTP is not correct.' });
  challenges.delete(String(challenge));
  if (c.kind === 'register') { const { plain, ...u } = c.reg!; insertUser(u, plain); S = loadState(); await audit(u.name, u.role, 'Registered a new account', u.loginId); }
  const u = userById(uidv)!; signIn(res, u); if (c.kind === 'login') await audit(u.name, u.role, 'Signed in with OTP', u.loginId);
  res.json({ user: u });
});
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const b = z.object({ role: z.enum(['officer', 'institution', 'bank']), aicteId: z.string().optional(), loginId: z.string().optional(), name: z.string().max(80).optional(), designation: z.string().max(80).optional(), region: z.string().optional(), bankCode: z.string().max(6).optional(), bankRole: z.enum(['maker', 'checker']).optional(), email: z.string().email(), mobile: z.string().regex(/^\d{10}$/), password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'Check the form: valid email, 10-digit mobile and a password of 8+ characters with letters and numbers.' });
  const f = b.data; let u: User;
  if (f.role === 'institution') {
    const r = await fetch(`${SELF}/mock/aicte/v1/institutions/${encodeURIComponent(f.aicteId || '')}`, { headers: { 'x-api-key': MOCK_KEYS.aicte } });
    if (!r.ok) return res.status(404).json({ error: 'No approved institution with this Permanent ID in the AICTE register.' });
    const ai = await r.json() as { name: string }; const inst = S.institutions.find(i => i.aicteId === f.aicteId)!;
    if (db.prepare("SELECT 1 FROM users WHERE login_id = ?").get(f.aicteId!)) return res.status(409).json({ error: 'An account already exists for this institution.' });
    u = { id: randomId('U'), role: 'institution', loginId: f.aicteId!, password: '', name: 'Registrar, ' + ai.name, designation: 'Registrar', email: f.email, mobile: f.mobile, instId: inst.id };
  } else {
    const login = (f.loginId || '').trim(); if (!login) return res.status(400).json({ error: 'Enter your user ID.' });
    if (db.prepare('SELECT 1 FROM users WHERE login_id = ?').get(login)) return res.status(409).json({ error: 'That user ID is already registered.' });
    u = f.role === 'officer' ? { id: randomId('U'), role: 'officer', loginId: login, password: '', name: f.name || 'Officer', designation: f.designation || 'Scrutiny officer', email: f.email, mobile: f.mobile, region: (f.region as User['region']) || 'HQ' }
      : { id: randomId('U'), role: 'bank', loginId: login, password: '', name: f.name || 'Bank user', designation: f.bankRole === 'checker' ? 'Branch manager (checker)' : 'Branch officer (maker)', email: f.email, mobile: f.mobile, bankCode: f.bankCode || 'SBIN', bankRole: f.bankRole || 'maker' };
  }
  const ch = randomId('CH'); challenges.set(ch, { kind: 'register', reg: { ...u, plain: f.password }, exp: Date.now() + 10 * 60_000 });
  res.json({ otpRequired: true, challenge: ch, ...issueOtp(u, 'register', ch) });
});
app.get('/api/aicte/lookup/:aicteId', authLimiter, async (req, res) => { const r = await fetch(`${SELF}/mock/aicte/v1/institutions/${encodeURIComponent(req.params.aicteId)}`, { headers: { 'x-api-key': MOCK_KEYS.aicte } }); if (!r.ok) return res.status(404).json({ error: 'No approved institution with this Permanent ID in the AICTE register.' }); const j = await r.json() as Record<string, string>; const taken = !!db.prepare('SELECT 1 FROM users WHERE login_id = ?').get(req.params.aicteId); res.json({ ...j, taken }); });
app.post('/api/auth/logout', async (req: AReq, res) => { if (req.user) await audit(req.user.name, req.user.role, 'Signed out', req.user.loginId); res.clearCookie('sdfp'); res.json({ ok: true }); });
app.post('/api/auth/demo-switch', async (req: AReq, res) => { if (!DEMO) return res.status(404).end(); const u = userById(String(req.body?.userId)); if (!u || !['U1', 'U2', 'U3', 'U4'].includes(u.id)) return res.status(400).json({ error: 'Unknown demo user.' }); signIn(res, u); await audit(u.name, u.role, 'Signed in (demo switch)', u.loginId); res.json({ user: u }); });

/* ---------- OTP for sensitive actions ---------- */
app.post('/api/otp', need(), (req: AReq, res) => { const purpose = String(req.body?.purpose); if (!['esign', 'release', 'lien'].includes(purpose)) return res.status(400).json({ error: 'Unknown purpose.' }); res.json(issueOtp(req.user!, purpose, String(req.body?.ref || ''))); });

/* ---------- actions: every change goes through the shared, permission-checked action layer ---------- */
app.post('/api/act/:name', need(), (req: AReq, res) => serial(async () => {
  const before = S; const next = structuredClone(S); const ctx = makeCtx(next, req.user!);
  try {
    const result = await runAction(next, req.user!, req.params.name, req.body || {}, ctx);
    if (req.params.name === 'demo.setOffset') { if (!DEMO) throw new ActionError('Time machine is disabled.'); runScan(next); }
    saveDiff(before, next); S = next; void deliver(S);
    res.json({ ok: true, result, state: viewFor(req.user!) });
  } catch (e) { res.status(e instanceof ActionError ? 400 : 500).json({ error: e instanceof ActionError ? e.message : 'Server error: ' + (e as Error).message }); if (!(e instanceof ActionError)) console.error(e); }
}));

/* ---------- files: encrypted at rest, access checked on every read ---------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, /^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.mimetype)) });
app.post('/api/files', need('institution', 'officer', 'bank'), upload.single('file'), async (req: AReq, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF, JPG or PNG up to 15 MB.' });
  const r = await makeCtx(S, req.user!).saveFile(new Uint8Array(req.file.buffer), req.file.mimetype, req.file.originalname.slice(0, 120));
  res.json(r);
});
app.get('/api/docs/:depId/:docId', need(), (req: AReq, res) => {
  const d = S.deposits.find(x => x.id === req.params.depId); if (!d || !canSee(req.user!, d)) return res.status(404).end();
  const doc = d.docs.find(x => x.id === req.params.docId); if (!doc) return res.status(404).end();
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(doc.id) as { mime: string } | undefined;
  if (f) { const blob = fs.readFileSync(path.join(DATA_DIR, 'files', doc.id + '.bin')); res.type(f.mime).send(decrypt(blob)); return; }
  res.type('application/pdf').send(Buffer.from(generatedDoc(doc, d, S.institutions.find(i => i.id === d.instId)!)));
});

/* ---------- audit verification straight from the database ---------- */
app.get('/api/audit/verify', need('officer'), (_req, res) => {
  let prev = '0'.repeat(64); for (const a of auditRows()) { const h = sha256(`${prev}|${a.at}|${a.actor}|${a.action}|${a.ref}`); if (a.prev !== prev || h !== a.hash) return res.json({ ok: false, at: a.seq, total: auditRows().length }); prev = a.hash; }
  res.json({ ok: true, total: auditRows().length });
});
let tampered: { seq: number; action: string } | null = null;
app.post('/api/demo/audit-tamper', need('officer'), (_req, res) => serial(async () => { if (!DEMO) return void res.status(404).end(); const k = Math.max(1, S.audit.length - 12); const row = S.audit[k - 1]; tampered = { seq: k, action: row.action }; const edited = row.action.replace(/Confirmed|Submitted|Released|Signed|E-signed/, 'Edited'); tamperAuditRow(k, edited === row.action ? row.action + ' (edited)' : edited); S = loadState(); res.json({ seq: k, state: viewFor(null) && undefined }); }));
app.post('/api/demo/audit-restore', need('officer'), (_req, res) => serial(async () => { if (tampered) { tamperAuditRow(tampered.seq, tampered.action); tampered = null; } S = loadState(); res.json({ ok: true }); }));

/* ---------- integration tests: live HTTP calls to the external (mock) services ---------- */
app.post('/api/integrations/test/:name', need('officer'), async (req: AReq, res) => {
  const t0 = Date.now(); let out: Record<string, unknown>;
  const dep = S.deposits.find(d => d.kind === 'FDR' && d.verification === 'Verified' && d.claimed.maturity > today(S) && !d.replacedBy)!; const inst0 = S.institutions[0];
  const call = async (method: string, url: string, key: string, body?: unknown) => { const r = await fetch(SELF + url, { method, headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { endpoint: `${method} ${url}`, status: r.status, latency_ms: Date.now() - t0, body: await r.json() }; };
  switch (req.params.name) {
    case 'aicte': out = await call('GET', `/mock/aicte/v1/institutions/${inst0.aicteId}`, MOCK_KEYS.aicte); break;
    case 'cbs': out = await call('GET', `/mock/cbs/v1/fdr?number=${encodeURIComponent(dep.number)}&ifsc=${dep.ifsc}`, MOCK_KEYS.cbs); break;
    case 'pg': { const o = await call('POST', '/mock/pg/v1/orders', MOCK_KEYS.pg, { amount: 100, ref: 'TEST-' + Date.now() }); out = { create: o, pay: await call('POST', `/mock/pg/v1/orders/${(o.body as { order_id: string }).order_id}/pay`, MOCK_KEYS.pg) }; break; }
    case 'notify': { const n = (S.outbox || []).length; out = { transport: process.env.SMTP_HOST ? `SMTP ${process.env.SMTP_HOST}` : 'local JSON outbox (set SMTP_HOST to send real email)', sms: process.env.SMS_WEBHOOK ? 'webhook' : 'local SMS log', messages_in_outbox: n, queued: (S.outbox || []).filter(o => o.status === 'Queued').length, last: (S.outbox || [])[0] }; break; }
    default: return res.status(404).json({ error: 'Not connected in the prototype.' });
  }
  await audit(req.user!.name, 'officer', `Tested integration: ${req.params.name} (HTTP ${String((out as { status?: number }).status ?? 200)})`);
  res.json(out);
});

/* ---------- automation ---------- */
async function scheduledScan(by = 'SDFP scheduler (02:00)') { return serial(async () => { const before = S; const next = structuredClone(S); const r = runScan(next, by); saveDiff(before, next); S = next; await deliver(S); console.log(`[sdfp] scan: ${r.reminders} reminders, ${r.escalations} escalations`); return r; }); }
app.post('/api/automation/run', need('officer'), async (req: AReq, res) => { const r = await scheduledScan(`Manual scan by ${req.user!.name}`); res.json({ reminders: r.reminders, escalations: r.escalations, sent: r.sent.length, state: viewFor(req.user!) }); });
cron.schedule('0 2 * * *', () => void scheduledScan(), { timezone: 'Asia/Kolkata' });
cron.schedule('0 9 * * 1', () => void serial(async () => { const before = S; const next = structuredClone(S); const x = stats(next); next.outbox ||= []; next.outbox.unshift({ id: uid('MSG'), at: today(next), channel: 'Email', to: 'Regional Directors', subject: 'Weekly SDFP status summary', body: `Open deposits ${x.open.length}; expiring ${x.byLife.Expiring.n}; pending verification ${x.byLife.Pending.n}; matured ${x.byLife.Matured.n}.`, status: 'Queued' }); saveDiff(before, next); S = next; await deliver(S); }), { timezone: 'Asia/Kolkata' });

/* ---------- public ---------- */
app.get('/api/public/shield', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase(); if (q.length < 2) return res.json([]);
  const t = today(S);
  res.json(S.institutions.filter(i => (i.name + ' ' + i.city + ' ' + i.state).toLowerCase().includes(q)).slice(0, 12).map(i => {
    const deps = S.deposits.filter(d => d.instId === i.id && isOpen(d)); const valid = deps.filter(d => { const l = life(d, S, t); return l === 'Active' || l === 'Expiring'; });
    const held = valid.reduce((a, d) => a + (d.confirmed?.amountLakh || 0), 0);
    const st = i.status !== 'Active' ? { tone: 'neutral', label: `Institution ${i.status.toLowerCase()}`, note: 'Deposit is being settled by AICTE' } : valid.length && held >= i.requiredLakh ? { tone: 'good', label: 'Security deposit valid', note: 'Bank-confirmed' } : deps.some(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker') ? { tone: 'info', label: 'Under verification', note: 'Bank confirmation in progress' } : { tone: 'bad', label: 'Not valid right now', note: 'AICTE is following up' };
    return { id: i.id, name: i.name, city: i.city, state: i.state, aicteId: i.aicteId, ...st };
  }));
});
app.post('/api/demo/reset', need(), (req: AReq, res) => serial(async () => { if (!DEMO) return void res.status(404).end(); seedIfEmpty(true); S = loadState(); res.clearCookie('sdfp'); res.json({ ok: true }); }));

/* ---------- web app ---------- */
const dist = path.resolve(process.cwd(), 'dist', 'index.html');
app.get('*', (req, res, next) => { if (req.path.startsWith('/api/') || req.path.startsWith('/mock/')) return next(); if (!fs.existsSync(dist)) return res.status(503).send('Run "npm run build" first.'); res.type('html').send(fs.readFileSync(dist, 'utf8').replace('<head>', '<head><script>window.__SDFP_API__=true</script>')); });
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => { console.log(`[sdfp] AICTE SDFP server on http://localhost:${PORT}  (demo mode: ${DEMO})`); void scheduledScan('SDFP scheduler (startup)'); });
export { S };
void z; void randomCode; void Buffer;
