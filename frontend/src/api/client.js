// The ONLY file that talks to the backend.
// Today it returns mock data. When Preet's API is ready, set USE_MOCK = false
// and the screens keep working unchanged.

import { mockFdrs, mockAuditLog, verification } from '../data/mockFdrs';
import { entryHash, GENESIS_HASH, verifyChain } from '../utils/hashChain';
import { daysUntil, formatDate } from '../utils/format';

const USE_MOCK = true;
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let fdrs = [...mockFdrs];
let auditLog = mockAuditLog.map((e) => ({ ...e, hash: null, prevHash: null })); // newest first

// Mock only: the backend writes audit entries itself.
// Each entry's hash is computed once, when it is recorded, and stored — like the backend does.
// Hashing is async (Web Crypto), so entries are sealed in order on a queue; reads wait for it.
let sealing = Promise.resolve();
const seal = (entry) => {
  sealing = sealing.then(async () => {
    const prev = auditLog.find((e) => e.id === entry.id - 1);
    entry.prevHash = prev ? prev.hash : GENESIS_HASH;
    entry.hash = await entryHash(entry.prevHash, entry);
  });
};
[...auditLog].reverse().forEach(seal);

const logAction = (actor, action, fdrId) => {
  const entry = { id: auditLog[0].id + 1, at: new Date().toISOString(), actor, action, fdrId, hash: null, prevHash: null };
  auditLog = [entry, ...auditLog];
  seal(entry);
};

async function http(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getFdrs({ institutionId, status } = {}) {
  if (!USE_MOCK) return http(`/fdrs?${new URLSearchParams({ ...(status && { status }) })}`);
  await delay();
  return fdrs.filter((f) => (!institutionId || f.institution.id === institutionId) && (!status || f.status === status));
}

export async function getFdr(id) {
  if (!USE_MOCK) return http(`/fdrs/${id}`);
  await delay();
  return fdrs.find((f) => f.id === id) || null;
}

function addMockFdr(data, renewalOf = null) {
  const fdr = {
    renewedBy: null, refundRequest: null, ...data, renewalOf,
    id: `FDR-2026-${String(fdrs.length + 1).padStart(4, '0')}`, status: 'SUBMITTED', verification: { fields: [], score: 0, total: 0 },
  };
  fdrs = [fdr, ...fdrs];
  logAction(fdr.institution.name, 'FDR_SUBMITTED', fdr.id);
  return fdr;
}

const updateMockFdr = (id, changes) => {
  fdrs = fdrs.map((f) => (f.id === id ? { ...f, ...changes } : f));
  return fdrs.find((f) => f.id === id);
};

export async function createFdr(data) {
  if (!USE_MOCK) return http('/fdrs', { method: 'POST', body: JSON.stringify(data) });
  await delay(500);
  return addMockFdr(data);
}

// Lodge a new FDR replacing `id`. Returns the NEW FDR; the old one becomes RENEWED.
export async function renewFdr(id, data) {
  if (!USE_MOCK) return http(`/fdrs/${id}/renew`, { method: 'POST', body: JSON.stringify(data) });
  await delay(500);
  const old = fdrs.find((f) => f.id === id);
  logAction(old.institution.name, 'FDR_RENEWED', id);
  const fdr = addMockFdr(data, id);
  updateMockFdr(id, { status: 'RENEWED', renewedBy: fdr.id });
  return fdr;
}

export async function requestRefund(id, reason) {
  if (!USE_MOCK) return http(`/fdrs/${id}/refund-request`, { method: 'POST', body: JSON.stringify({ reason }) });
  await delay();
  const fdr = fdrs.find((f) => f.id === id);
  logAction(fdr.institution.name, 'REFUND_REQUESTED', id);
  return updateMockFdr(id, { status: 'REFUND_REQUESTED', refundRequest: { reason, requestedAt: new Date().toISOString(), decision: null, remarks: null } });
}

// checklist: { matured, noComplaints, documentReturned } — all must be true to approve
export async function decideRefund(id, decision, remarks, checklist) {
  if (!USE_MOCK) return http(`/fdrs/${id}/refund-decision`, { method: 'POST', body: JSON.stringify({ decision, remarks, checklist }) });
  await delay();
  const fdr = fdrs.find((f) => f.id === id);
  const approve = decision === 'APPROVE';
  logAction('Officer R. Sharma', approve ? 'FDR_REFUNDED' : 'REFUND_REJECTED', id);
  return updateMockFdr(id, {
    status: approve ? 'REFUNDED' : 'ACTIVE',
    refundRequest: { ...fdr.refundRequest, decision: approve ? 'APPROVED' : 'REJECTED', remarks: remarks || null },
  });
}

export const VERIFICATION_STEPS = [
  { key: 'OCR', label: 'Reading document (OCR)' },
  { key: 'BANK', label: 'Checking with bank' },
  { key: 'RULES', label: 'Running rules' },
];

// Mock OCR demo trigger: an FDR number ending in "X" (e.g. SBI/FD/12345X) makes OCR
// misread the amount, like a scanner confusing 2 and 7. Anything else matches.
const OCR_DIGIT_SWAP = { 0: '8', 8: '0', 1: '7', 7: '1', 5: '6', 6: '5', 3: '8', 2: '7', 4: '9', 9: '4' };
const misreadAmount = (amount) => String(amount).replace(/\d/, (d) => OCR_DIGIT_SWAP[d]);

// Automated checks on a just-uploaded FDR; onStep(key) fires as each step finishes.
// The backend runs these on upload, so the real API has no per-step progress to report.
export async function runVerification(id, onStep = () => {}) {
  if (!USE_MOCK) {
    const fdr = await http(`/fdrs/${id}`);
    VERIFICATION_STEPS.forEach((s) => onStep(s.key));
    return fdr;
  }
  const fdr = fdrs.find((f) => f.id === id);
  const overrides = {};
  await delay(1400);
  if (/x$/i.test(fdr.fdrNumber.trim())) {
    const claimed = String(fdr.amount);
    overrides.amount = [claimed, misreadAmount(fdr.amount), claimed]; // the bank record agrees with the institution
  }
  onStep('OCR');
  await delay(1200);
  onStep('BANK');
  await delay(900);
  onStep('RULES');
  return updateMockFdr(id, { verification: verification(fdr, overrides) });
}

export async function verifyFdr(id, decision, remarks) {
  if (!USE_MOCK) return http(`/fdrs/${id}/verify`, { method: 'POST', body: JSON.stringify({ decision, remarks }) });
  await delay();
  const next = { APPROVE: 'ACTIVE', REJECT: 'REJECTED', CORRECTION: 'CORRECTION_REQUESTED' }[decision];
  const officer = 'Officer R. Sharma';
  if (fdrs.find((f) => f.id === id)?.status === 'SUBMITTED') logAction(officer, 'SCRUTINY_STARTED', id);
  logAction(officer, { APPROVE: 'FDR_APPROVED', REJECT: 'FDR_REJECTED', CORRECTION: 'CORRECTION_REQUESTED' }[decision], id);
  if (decision === 'APPROVE') logAction('System', 'FDR_ACTIVATED', id);
  return updateMockFdr(id, { status: next });
}

// asOf = the Time Machine date (defaults to today)
export async function getDashboardStats(asOf = new Date()) {
  if (!USE_MOCK) return http(`/dashboard/stats?asOf=${asOf.toISOString().slice(0, 10)}`);
  await delay();
  const live = fdrs.filter((f) => !['REJECTED', 'REFUNDED', 'RENEWED'].includes(f.status));
  const left = (f) => daysUntil(f.maturityDate, asOf);
  const group = (key) =>
    Object.entries(live.reduce((acc, f) => ({ ...acc, [key(f)]: (acc[key(f)] || 0) + f.amount }), {})).map(([name, amount]) => ({ name, amount }));
  return {
    total: live.length,
    active: live.filter((f) => left(f) > 30).length,
    expiring30: live.filter((f) => left(f) >= 0 && left(f) <= 30).length,
    expired: live.filter((f) => left(f) < 0).length,
    pendingScrutiny: live.filter((f) => ['SUBMITTED', 'UNDER_SCRUTINY'].includes(f.status)).length,
    totalAmount: live.reduce((s, f) => s + f.amount, 0),
    byState: group((f) => f.institution.state),
    byBank: group((f) => f.bankName),
  };
}

// Newest first. Pass fdrId for one FDR's history (used for its lifecycle timeline).
export async function getAuditLog({ fdrId } = {}) {
  if (!USE_MOCK) return http(`/audit-log${fdrId ? `?fdrId=${encodeURIComponent(fdrId)}` : ''}`);
  await delay();
  await sealing;
  return (fdrId ? auditLog.filter((e) => e.fdrId === fdrId) : auditLog).map((e) => ({ ...e }));
}

// Recomputes every hash from the first entry. Returns { valid, entries, brokenAt }.
export async function verifyAuditLog() {
  if (!USE_MOCK) return http('/audit-log/verify');
  await delay(600);
  await sealing;
  return verifyChain([...auditLog].reverse());
}

// Demo only (mock): edit one past entry in storage without touching its stored hash,
// the way someone tampering with the database directly would. Turning it off restores it.
export const CAN_SIMULATE_TAMPERING = USE_MOCK;
const TAMPER = { fdrId: 'FDR-2026-0001', from: 'FDR_APPROVED', to: 'FDR_REJECTED' };
let tamperedId = null;

export async function setAuditTampering(on) {
  await sealing;
  if (on && !tamperedId) {
    const target = auditLog.find((e) => e.fdrId === TAMPER.fdrId && e.action === TAMPER.from);
    target.action = TAMPER.to;
    tamperedId = target.id;
  } else if (!on && tamperedId) {
    auditLog.find((e) => e.id === tamperedId).action = TAMPER.from;
    tamperedId = null;
  }
  const id = on ? tamperedId : auditLog.find((e) => e.fdrId === TAMPER.fdrId && e.action === TAMPER.from)?.id;
  return { id, ...TAMPER };
}

// ---- Notifications (reminders + escalations) ----
// Mock: generated from maturity dates. Reminders go out 90/60/30/7 days before maturity;
// an FDR is escalated to AICTE 7 days before maturity if there is no renewal or refund request.

const REMINDER_DAYS = [90, 60, 30, 7];
const ESCALATE_DAYS = 7;
const REMINDED = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'REFUND_REQUESTED', 'REFUNDED']; // accepted FDRs only
const readIds = new Set();

const isoDay = (date) => date.toISOString().slice(0, 10);
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};
// Day the institution renewed or asked for a refund, which stops further reminders (a rejected refund restarts them)
const resolvedOn = (fdrId) => {
  const last = auditLog.find((e) => e.fdrId === fdrId && ['FDR_RENEWED', 'REFUND_REQUESTED', 'REFUND_REJECTED'].includes(e.action));
  return last && last.action !== 'REFUND_REJECTED' ? last.at.slice(0, 10) : undefined;
};

function mockNotifications() {
  const list = [];
  for (const f of fdrs.filter((x) => REMINDED.includes(x.status))) {
    const resolved = resolvedOn(f.id);
    const add = (type, day, message) => {
      if (!resolved || day < resolved) list.push({ id: `NTF-${f.id}-${type}`, at: `${day}T03:30:00Z`, type, message, fdrId: f.id });
    };
    const of = `${f.fdrNumber} of ${f.institution.name}`;
    REMINDER_DAYS.forEach((n) => add(`REMINDER_${n}`, addDays(f.maturityDate, -n),
      `${of} matures on ${formatDate(f.maturityDate)} (in ${n} days). Renew it or request a refund.`));
    add('ESCALATED', addDays(f.maturityDate, -ESCALATE_DAYS),
      `Escalated to AICTE: ${of} matures on ${formatDate(f.maturityDate)} with no renewal or refund request.`);
  }
  return list;
}

// Without upcomingDays: notifications sent up to asOf (default today), newest first — the bell.
// With upcomingDays: those due from asOf to asOf + upcomingDays, plus escalations still open,
// soonest first — the admin's "Upcoming reminders" panel (asOf = Time Machine date).
// The backend filters by the logged-in user; the mock filters by institutionId (institutions don't see escalations).
export async function getNotifications({ asOf = new Date(), upcomingDays, institutionId } = {}) {
  if (!USE_MOCK) return http(`/notifications?${new URLSearchParams({ asOf: isoDay(asOf), ...(upcomingDays && { upcomingDays }) })}`);
  await delay();
  const today = isoDay(asOf);
  const dayOf = (n) => n.at.slice(0, 10);
  let list = mockNotifications();
  if (institutionId) list = list.filter((n) => n.type !== 'ESCALATED' && fdrs.find((f) => f.id === n.fdrId).institution.id === institutionId);
  if (upcomingDays) {
    const until = addDays(today, upcomingDays);
    const stillOpen = (n) => n.type === 'ESCALATED' && dayOf(n) < today && !(resolvedOn(n.fdrId) <= today);
    list = list.filter((n) => (dayOf(n) >= today && dayOf(n) <= until) || stillOpen(n)).sort((a, b) => a.at.localeCompare(b.at));
  } else {
    list = list.filter((n) => dayOf(n) <= today).sort((a, b) => b.at.localeCompare(a.at));
  }
  const readBefore = addDays(isoDay(new Date()), -14); // mock: anything older than two weeks starts as read
  return list.map((n) => ({ ...n, read: readIds.has(n.id) || dayOf(n) < readBefore }));
}

export async function markNotificationRead(id) {
  if (!USE_MOCK) return http(`/notifications/${id}/read`, { method: 'POST' });
  readIds.add(id);
  return { id, read: true };
}
