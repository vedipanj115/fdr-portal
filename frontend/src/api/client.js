// The ONLY file that talks to the backend.
// Today it returns mock data. When Preet's API is ready, set USE_MOCK = false
// and the screens keep working unchanged.

import { mockFdrs, mockAuditLog, chainEntry } from '../data/mockFdrs';
import { daysUntil } from '../utils/format';

const USE_MOCK = true;
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let fdrs = [...mockFdrs];
let auditLog = [...mockAuditLog];

// Mock only: the backend writes audit entries itself.
const logAction = (actor, action, fdrId) => {
  auditLog = [chainEntry(auditLog, { at: new Date().toISOString(), actor, action, fdrId }), ...auditLog];
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

export async function createFdr(data) {
  if (!USE_MOCK) return http('/fdrs', { method: 'POST', body: JSON.stringify(data) });
  await delay(500);
  const fdr = { ...data, id: `FDR-2026-${String(fdrs.length + 1).padStart(4, '0')}`, status: 'SUBMITTED', verification: { fields: [], score: 0, total: 0 } };
  fdrs = [fdr, ...fdrs];
  return fdr;
}

export async function verifyFdr(id, decision, remarks) {
  if (!USE_MOCK) return http(`/fdrs/${id}/verify`, { method: 'POST', body: JSON.stringify({ decision, remarks }) });
  await delay();
  const next = { APPROVE: 'ACTIVE', REJECT: 'REJECTED', CORRECTION: 'CORRECTION_REQUESTED' }[decision];
  const officer = 'Officer R. Sharma';
  if (fdrs.find((f) => f.id === id)?.status === 'SUBMITTED') logAction(officer, 'SCRUTINY_STARTED', id);
  logAction(officer, { APPROVE: 'FDR_APPROVED', REJECT: 'FDR_REJECTED', CORRECTION: 'CORRECTION_REQUESTED' }[decision], id);
  if (decision === 'APPROVE') logAction('System', 'FDR_ACTIVATED', id);
  fdrs = fdrs.map((f) => (f.id === id ? { ...f, status: next } : f));
  return fdrs.find((f) => f.id === id);
}

// asOf = the Time Machine date (defaults to today)
export async function getDashboardStats(asOf = new Date()) {
  if (!USE_MOCK) return http(`/dashboard/stats?asOf=${asOf.toISOString().slice(0, 10)}`);
  await delay();
  const live = fdrs.filter((f) => !['REJECTED', 'REFUNDED'].includes(f.status));
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
  return fdrId ? auditLog.filter((e) => e.fdrId === fdrId) : auditLog;
}
