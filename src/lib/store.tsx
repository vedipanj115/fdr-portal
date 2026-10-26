import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, Deposit, Doc, Role, User } from './types';
import { seed } from './data';
import { sha256, todayReal, uid } from './util';
import { today } from './rules';
import { ActionError, runAction, pushAudit, type Ctx as ActCtx } from './actions';
import { runScan } from './automation';
import { generatedDoc } from './docgen';

/** true when the page is served by the SDFP server (real database, real auth); false in the standalone demo */
export const API = typeof window !== 'undefined' && !!(window as unknown as { __SDFP_API__?: boolean }).__SDFP_API__;
const KEY = 'sdfp-state-v3', SKEY = 'sdfp-session-v3';
export const FILES = new Map<string, { bytes: Uint8Array; mime: string }>(); // offline mode: uploaded files live in memory

/* ---------- offline mode helpers ---------- */
function load(): AppState {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s.version === 3) return s; } } catch { /* storage unavailable */ }
  const s = seed(todayReal()); s.outbox = []; s.lastScan = s.baseDate.slice(0, 8) + '01'; runScan(s, 'SDFP scheduler (startup)'); s.outbox.forEach(m => { if (m.status === 'Queued') m.status = 'Delivered (offline demo)'; }); return s;
}
const LOCAL_CBS = new Map<string, { amountLakh: number; maturity: string; lien: boolean; holder: string }>();
const DEMO_OTP: Record<string, string> = { login: '246810', register: '135790', esign: '731520', lien: '731520', release: '482913' };
function localCtx(s: AppState): ActCtx {
  return {
    async saveFile(bytes, mime) { const id = uid('F'); FILES.set(id, { bytes, mime }); return { id, sha256: sha256(bytes), sizeKb: Math.max(1, Math.round(bytes.length / 1024)) }; },
    async fileInfo(id) { const f = FILES.get(id); return f ? { sha256: sha256(f.bytes), sizeKb: Math.max(1, Math.round(f.bytes.length / 1024)), mime: f.mime } : null; },
    async cbsLookup(number, ifsc) {
      await new Promise(r => setTimeout(r, 500));
      const reg = LOCAL_CBS.get(number + '|' + ifsc); if (reg) return { found: true, ...reg };
      const d = s.deposits.find(x => x.number === number && x.ifsc === ifsc && x.kind === 'FDR'); if (!d || d.bankCode === 'SLCC') return { found: false };
      const c = d.cbs || { amountLakh: d.claimed.amountLakh, maturity: d.claimed.maturity, lien: true };
      return { found: true, amountLakh: c.amountLakh, maturity: c.maturity, lien: c.lien, holder: s.institutions.find(i => i.id === d.instId)?.name };
    },
    async cbsRegister(r) { LOCAL_CBS.set(r.number + '|' + r.ifsc, r); },
    async verifyOtp(purpose, _ref, otp) { return otp === DEMO_OTP[purpose]; },
    async pay() { await new Promise(r => setTimeout(r, 700)); return { txnId: 'TXN' + Math.random().toString(16).slice(2, 12).toUpperCase(), settled: true }; },
    notify(to, channel, subject, body, ref) { s.outbox ||= []; s.outbox.unshift({ id: uid('MSG'), at: today(s), channel, to, subject, body, ref, status: 'Delivered to local outbox' }); },
  };
}

async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body instanceof FormData || body === undefined ? undefined : { 'content-type': 'application/json' }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ActionError((j as { error?: string }).error || `Request failed (${r.status})`);
  return j as T;
}

export type Route = { page: string; id?: string };
interface Toast { id: number; text: string; tone: 'good' | 'bad' | 'info' }
export interface OtpInfo { to: string; devCode?: string; challenge?: string }
export type LoginResult = { user: User } | { otp: OtpInfo } | { error: string };
export interface RegisterForm { role: Role; aicteId?: string; loginId?: string; name?: string; designation?: string; region?: string; bankCode?: string; bankRole?: 'maker' | 'checker'; email: string; mobile: string; password: string }
interface Ctx {
  s: AppState; user: User | null; route: Route; api: boolean; ready: boolean;
  /** run a server-checked action; returns null (and shows the error) if it was refused */
  act: <T = unknown>(name: string, payload?: Record<string, unknown>, opts?: { quiet?: boolean; err?: { m: string } }) => Promise<{ result: T } | null>;
  nav: (page: string, id?: string) => void;
  login: (role: Role, loginId: string, pw: string) => Promise<LoginResult>;
  verifyLogin: (challenge: string, otp: string) => Promise<LoginResult>;
  register: (f: RegisterForm) => Promise<LoginResult>;
  lookupAicte: (id: string) => Promise<{ name: string; city: string; region: string; taken: boolean } | { error: string }>;
  demoSwitch: (u: User) => Promise<void>;
  logout: () => Promise<void>;
  requestOtp: (purpose: string, ref: string) => Promise<OtpInfo>;
  upload: (bytes: Uint8Array, mime: string, name: string) => Promise<{ id: string; sha256: string; sizeKb: number }>;
  fetchDoc: (doc: Doc, d: Deposit) => Promise<{ bytes: Uint8Array; mime: string }>;
  refresh: () => Promise<void>;
  auditOp: (op: 'verify' | 'tamper' | 'restore') => Promise<{ ok: boolean; at?: number; total: number; seq?: number }>;
  testIntegration: (name: string) => Promise<object>;
  runScanNow: () => Promise<{ reminders: number; escalations: number; sent: number } | null>;
  toast: (text: string, tone?: Toast['tone']) => void; toasts: Toast[];
  reset: () => Promise<void>;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(() => (API ? seedPlaceholder() : load()));
  const [ready, setReady] = useState(!API);
  const sRef = useRef(s); sRef.current = s;
  const [user, setUserState] = useState<User | null>(() => {
    if (API) return null;
    try { const id = localStorage.getItem(SKEY); if (id) return load().users.find(u => u.id === id) || null; } catch { /* */ }
    return null;
  });
  const [route, setRoute] = useState<Route>({ page: 'home' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const challenges = useRef(new Map<string, { user?: User; reg?: User }>());

  useEffect(() => { if (API) return; const h = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota or blocked */ } }, 300); return () => clearTimeout(h); }, [s]);
  const refresh = useCallback(async () => { if (!API) return; const j = await api<{ user: User | null; state: AppState }>('/api/state'); setS(j.state); setUserState(j.user); setReady(true); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const nav = useCallback((page: string, id?: string) => { setRoute({ page, id }); window.scrollTo({ top: 0 }); }, []);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'good') => {
    const id = ++tid.current; setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4600);
  }, []);
  const enter = useCallback((u: User | null) => {
    setUserState(u); setRoute({ page: 'home' }); setToasts([]);
    if (!API) try { if (u) localStorage.setItem(SKEY, u.id); else localStorage.removeItem(SKEY); } catch { /* */ }
  }, []);
  const userRef = useRef(user); userRef.current = user;

  const act = useCallback(async <T,>(name: string, payload: Record<string, unknown> = {}, opts?: { quiet?: boolean; err?: { m: string } }) => {
    try {
      if (API) { const j = await api<{ result: T; state: AppState }>(`/api/act/${name}`, payload); setS(j.state); return { result: j.result }; }
      const u = userRef.current; if (!u) throw new ActionError('Please sign in.');
      const next = structuredClone(sRef.current);
      const result = await runAction(next, u, name, payload, localCtx(next)) as T;
      if (name === 'demo.setOffset') { runScan(next); next.outbox?.forEach(m => { if (m.status === 'Queued') m.status = 'Delivered (offline demo)'; }); }
      sRef.current = next; setS(next); return { result };
    } catch (e) { if (opts?.err) opts.err.m = (e as Error).message; if (!opts?.quiet) toast(e instanceof ActionError ? e.message : 'Something went wrong: ' + (e as Error).message, 'bad'); if (!(e instanceof ActionError)) console.error(e); return null; }
  }, [toast]);
  const localAudit = (u: User, action: string) => { const n = structuredClone(sRef.current); pushAudit(n, u.name, u.role, action, u.loginId); sRef.current = n; setS(n); };

  const login = useCallback(async (role: Role, loginId: string, pw: string): Promise<LoginResult> => {
    if (API) {
      try { const j = await api<{ user?: User; otpRequired?: boolean; challenge?: string; to?: string; devCode?: string }>('/api/auth/login', { role, loginId, password: pw });
        if (j.user) { enter(j.user); await refresh(); return { user: j.user }; }
        return { otp: { challenge: j.challenge, to: j.to!, devCode: j.devCode } };
      } catch (e) { return { error: (e as Error).message }; }
    }
    const u = sRef.current.users.find(x => x.role === role && x.loginId.toLowerCase() === loginId.trim().toLowerCase());
    if (!u) return { error: 'No account with that ID for this portal.' };
    if (u.password !== pw) return { error: 'Incorrect password.' };
    if (role === 'institution') { localAudit(u, 'Signed in'); enter(u); return { user: u }; }
    const ch = uid('CH'); challenges.current.set(ch, { user: u });
    return { otp: { challenge: ch, to: '******' + u.mobile.slice(-4), devCode: DEMO_OTP.login } };
  }, [enter, refresh]);
  const verifyLogin = useCallback(async (challenge: string, otp: string): Promise<LoginResult> => {
    if (API) { try { const j = await api<{ user: User }>('/api/auth/otp', { challenge, otp }); enter(j.user); await refresh(); return { user: j.user }; } catch (e) { return { error: (e as Error).message }; } }
    const c = challenges.current.get(challenge); if (!c) return { error: 'This code has expired. Start again.' };
    const isReg = !!c.reg; if (otp !== (isReg ? DEMO_OTP.register : DEMO_OTP.login)) return { error: 'That OTP is not correct.' };
    challenges.current.delete(challenge);
    const u = (c.reg || c.user)!;
    if (isReg) { const n = structuredClone(sRef.current); n.users.push(u); pushAudit(n, u.name, u.role, 'Registered a new account', u.loginId); sRef.current = n; setS(n); }
    else localAudit(u, 'Signed in with OTP');
    enter(u); return { user: u };
  }, [enter, refresh]);
  const lookupAicte = useCallback(async (id: string) => {
    if (API) { try { const j = await api<{ name: string; city: string; region: string; taken: boolean }>(`/api/aicte/lookup/${encodeURIComponent(id.trim())}`); return j; } catch (e) { return { error: (e as Error).message }; } }
    const i = sRef.current.institutions.find(x => x.aicteId === id.trim()); if (!i) return { error: 'No approved institution with this Permanent ID in the AICTE register.' };
    return { name: i.name, city: i.city, region: i.region, taken: sRef.current.users.some(u => u.instId === i.id) };
  }, []);
  const register = useCallback(async (f: RegisterForm): Promise<LoginResult> => {
    if (API) { try { const j = await api<{ challenge: string; to: string; devCode?: string }>('/api/auth/register', f); return { otp: { challenge: j.challenge, to: j.to, devCode: j.devCode } }; } catch (e) { return { error: (e as Error).message }; } }
    const st = sRef.current; const i = f.role === 'institution' ? st.institutions.find(x => x.aicteId === f.aicteId) : undefined;
    if (f.role === 'institution' && !i) return { error: 'No approved institution with this Permanent ID in the AICTE register.' };
    if (st.users.some(u => u.loginId.toLowerCase() === (i?.aicteId || f.loginId || '').toLowerCase())) return { error: 'That ID is already registered.' };
    const u: User = { id: uid('U'), role: f.role, password: f.password, email: f.email, mobile: f.mobile, loginId: i ? i.aicteId : f.loginId!.trim(),
      name: i ? 'Registrar, ' + i.name : f.name || 'New user', designation: i ? 'Registrar' : f.role === 'officer' ? f.designation || 'Scrutiny officer' : f.bankRole === 'checker' ? 'Branch manager (checker)' : 'Branch officer (maker)',
      instId: i?.id, region: f.role === 'officer' ? (f.region as User['region']) || 'HQ' : undefined, bankCode: f.role === 'bank' ? f.bankCode : undefined, bankRole: f.role === 'bank' ? f.bankRole : undefined };
    const ch = uid('CH'); challenges.current.set(ch, { reg: u });
    return { otp: { challenge: ch, to: '******' + f.mobile.slice(-4), devCode: DEMO_OTP.register } };
  }, []);
  const demoSwitch = useCallback(async (u: User) => {
    if (API) { try { const j = await api<{ user: User }>('/api/auth/demo-switch', { userId: u.id }); enter(j.user); await refresh(); } catch (e) { toast((e as Error).message, 'bad'); } return; }
    localAudit(u, 'Signed in (demo switch)'); enter(u);
  }, [enter, refresh, toast]);
  const logout = useCallback(async () => {
    if (API) { await api('/api/auth/logout', {}).catch(() => null); enter(null); await refresh(); return; }
    if (userRef.current) localAudit(userRef.current, 'Signed out'); enter(null);
  }, [enter, refresh]);
  const requestOtp = useCallback(async (purpose: string, ref: string): Promise<OtpInfo> => {
    if (API) return api<OtpInfo>('/api/otp', { purpose, ref });
    return { to: '******' + (userRef.current?.mobile || '0000').slice(-4), devCode: DEMO_OTP[purpose] };
  }, []);
  const upload = useCallback(async (bytes: Uint8Array, mime: string, name: string) => {
    if (API) { const fd = new FormData(); fd.append('file', new Blob([bytes], { type: mime }), name); return api<{ id: string; sha256: string; sizeKb: number }>('/api/files', fd); }
    return localCtx(sRef.current).saveFile(bytes, mime, name);
  }, []);
  const docCache = useRef(new Map<string, { bytes: Uint8Array; mime: string }>());
  const fetchDoc = useCallback(async (doc: Doc, d: Deposit) => {
    const k = d.id + '/' + doc.id; const hit = docCache.current.get(k); if (hit) return hit;
    let out: { bytes: Uint8Array; mime: string };
    if (API) { const r = await fetch(`/api/docs/${encodeURIComponent(d.id)}/${encodeURIComponent(doc.id)}`, { credentials: 'same-origin' }); if (!r.ok) throw new Error('Could not load the document.'); out = { bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get('content-type')?.split(';')[0] || 'application/pdf' }; }
    else out = FILES.get(doc.id) || { bytes: generatedDoc(doc, d, sRef.current.institutions.find(i => i.id === d.instId)!), mime: 'application/pdf' };
    docCache.current.set(k, out); return out;
  }, []);
  const reset = useCallback(async () => {
    if (API) { await api('/api/demo/reset', {}).catch(e => toast((e as Error).message, 'bad')); enter(null); await refresh(); return; }
    try { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); } catch { /* */ }
    FILES.clear(); LOCAL_CBS.clear(); docCache.current.clear(); const n = load(); sRef.current = n; setS(n); setUserState(null); setRoute({ page: 'home' });
  }, [enter, refresh, toast]);

  const tampered = useRef<{ seq: number; action: string } | null>(null);
  const auditOp = useCallback(async (op: 'verify' | 'tamper' | 'restore') => {
    if (API) {
      if (op === 'verify') return api<{ ok: boolean; at?: number; total: number }>('/api/audit/verify');
      const r = await api<{ seq?: number }>(op === 'tamper' ? '/api/demo/audit-tamper' : '/api/demo/audit-restore', {}); await refresh(); return { ok: op === 'restore', total: 0, seq: r.seq };
    }
    const n = structuredClone(sRef.current);
    if (op === 'verify') { let prev = '0'.repeat(64); for (const a of n.audit) { if (a.prev !== prev || sha256(`${prev}|${a.at}|${a.actor}|${a.action}|${a.ref}`) !== a.hash) return { ok: false, at: a.seq, total: n.audit.length }; prev = a.hash; } return { ok: true, total: n.audit.length }; }
    if (op === 'tamper') { const k = Math.max(1, n.audit.length - 12); const row = n.audit[k - 1]; tampered.current = { seq: k, action: row.action }; row.action = row.action.replace(/Confirmed|Submitted|Released|Signed|E-signed/, 'Edited'); if (row.action === tampered.current.action) row.action += ' (edited)'; }
    else if (tampered.current) { n.audit[tampered.current.seq - 1].action = tampered.current.action; tampered.current = null; }
    sRef.current = n; setS(n); return { ok: op === 'restore', total: n.audit.length, seq: tampered.current?.seq };
  }, [refresh]);
  const testIntegration = useCallback(async (name: string) => {
    if (API) return api<object>(`/api/integrations/test/${name}`, {});
    await act('audit.log', { action: `Tested integration: ${name} (offline demo)` }, { quiet: true });
    return { mode: 'offline demo', note: 'Run the SDFP server (npm start) to call the live mock services over HTTP.' };
  }, [act]);
  const runScanNow = useCallback(async () => {
    try {
      if (API) { const r = await api<{ reminders: number; escalations: number; sent: number; state: AppState }>('/api/automation/run', {}); setS(r.state); return r; }
      const n = structuredClone(sRef.current); const r = runScan(n, `Manual scan by ${userRef.current?.name || 'officer'}`); n.outbox?.forEach(m => { if (m.status === 'Queued') m.status = 'Delivered (offline demo)'; }); sRef.current = n; setS(n); return { reminders: r.reminders, escalations: r.escalations, sent: r.sent.length };
    } catch (e) { toast((e as Error).message, 'bad'); return null; }
  }, [toast]);

  useEffect(() => { (window as unknown as { __sdfp: unknown }).__sdfp = { s, user, api: API }; }, [s, user]);
  const v = useMemo(() => ({ s, user, route, api: API, ready, act, nav, login, verifyLogin, register, lookupAicte, demoSwitch, logout, requestOtp, upload, fetchDoc, refresh, auditOp, testIntegration, runScanNow, toast, toasts, reset }),
    [s, user, route, ready, act, nav, login, verifyLogin, register, lookupAicte, demoSwitch, logout, requestOtp, upload, fetchDoc, refresh, auditOp, testIntegration, runScanNow, toast, toasts, reset]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

/** an empty-but-valid state shown for the split second before the server answers */
function seedPlaceholder(): AppState { const s = seed(todayReal()); return { ...s, deposits: [], audit: [], notices: [], vault: [], esign: [], outbox: [] }; }

export const instOf = (s: AppState, id: string) => s.institutions.find(i => i.id === id)!;
export const depOf = (s: AppState, id?: string) => s.deposits.find(d => d.id === id);
